import os
import numpy as np
import threading
import json
import requests  # OpenRouter er jonno
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from tensorflow.keras import layers, models
from tensorflow.keras.applications import MobileNetV2
from google import genai  # Gemini er jonno
from groq import Groq     # Groq er jonno
import uuid
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import datetime # Ekdom upore import kore niben jodi na thake
# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)

# Ensure an upload folder exists
UPLOAD_FOLDER = 'uploads'
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER

# 1. Define the exact 29 class names
CLASS_NAMES = [
    'corn_Blight', 'corn_Common_Rust', 'corn_Gray_Leaf_Spot', 'corn_Healthy',
    'groundnut_early_leaf_spot', 'groundnut_early_rust', 'groundnut_healthy_leaf',
    'groundnut_late_leaf_spot', 'groundnut_nutrition_deficiency', 'groundnut_rust',
    'potato_Earlyblight', 'potato_Healthy', 'potato_LateBlight',
    'rice_bacterial_leaf_blight', 'rice_brown_spot', 'rice_healthy',
    'rice_leaf_blast', 'rice_leaf_scald', 'rice_narrow_brown_spot',
    'tomato_Bacterial_spot', 'tomato_Early_blight', 'tomato_Late_blight',
    'tomato_Leaf_Mold', 'tomato_Septoria_leaf_spot',
    'tomato_Spider_mites Two-spotted_spider_mite', 'tomato_Target_Spot',
    'tomato_Tomato_Yellow_Leaf_Curl_Virus', 'tomato_Tomato_mosaic_virus', 'tomato_healthy'
]

# Load model globally
MODEL_PATH = 'plant_disease_model.keras'
print("Loading model architecture and weights...")
try:
    # 1. Base model toiri kora (weights=None karon amra .keras theke load korbo)
    base_model = MobileNetV2(input_shape=(224, 224, 3), include_top=False, weights=None)
    
    # 2. Ekdom apnar Colab training er moto Sequential model toiri kora
    model = models.Sequential([
        layers.Input(shape=(224, 224, 3)), # Input shape define kora holo
        layers.Rescaling(1./127.5, offset=-1),
        base_model,
        layers.GlobalAveragePooling2D(),
        layers.Dense(29, activation='softmax')
    ])
    
    # 3. .keras file theke sudhu Weights gulo (memory) load kora
    model.load_weights(MODEL_PATH)
    print("Model loaded successfully! 🚀")
except Exception as e:
    print(f"Error loading model: {e}")
    model = None


def predict_plant_disease(image_path):
    """Processes the image and predicts the class + confidence."""
    if model is None:
        print("❌ ERROR: Model is not loaded!")
        return "Error: Model not loaded.", 0

    try:
        from tensorflow.keras.utils import load_img, img_to_array
        img = load_img(image_path, target_size=(224, 224))
        img_array = img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0)
    except Exception as e:
        print(f"❌ IMAGE PROCESSING ERROR: {e}")
        return f"Error processing image: {e}", 0

    try:
        predictions = model.predict(img_array)
        predicted_index = np.argmax(predictions[0])
        
        confidence = float(predictions[0][predicted_index]) * 100
        predicted_class = CLASS_NAMES[predicted_index]

        return predicted_class, round(confidence, 1)
    except Exception as e:
        print(f"❌ MODEL PREDICTION ERROR: {e}")
        return f"Error during prediction: {e}", 0


def get_treatment_suggestion(predicted_class):
    """Fetches suggestion using Fallback: Gemini -> OpenRouter -> Groq"""
    if 'healthy' in predicted_class.lower():
        return json.dumps({
            "severity": "Low",
            "organic_solution": ["Keep watering regularly.", "Ensure proper sunlight.", "No treatment needed."],
            "chemical_medicine": ["None required.", "Avoid unnecessary fertilizers.", "Keep observing the plant."],
            "explanation": "The AI model analyzed the leaf and found no visible signs of fungal, bacterial, or viral infections. The plant appears to be in excellent health.",
            "prevention_tips": ["Maintain regular watering schedule", "Ensure good soil drainage", "Monitor for pests weekly", "Apply balanced organic compost"]
        })

    parts = predicted_class.split('_', 1)
    if len(parts) > 1:
        plant_name = parts[0].capitalize()
        disease_name = parts[1].replace('_', ' ')
    else:
        plant_name = "Plant"
        disease_name = predicted_class

    prompt = (
        f"A farmer's {plant_name} plant has been diagnosed with {disease_name}. "
        f"Provide the following exactly in JSON format: "
        f"1. Exactly 3 short, actionable steps for an organic solution. "
        f"2. Exactly 3 short, actionable steps for a chemical medicine. "
        f"3. A 2-sentence 'explanation' of why this disease occurs and its visual symptoms. "
        f"4. Exactly 4 short 'prevention_tips' to avoid this disease in the future. "
        f"5. Assess the general risk 'severity' to the crop yield as 'Low', 'Medium', or 'High'. "
        f"Return ONLY a valid JSON object with no markdown formatting. "
        f"Required JSON structure: "
        f'{{"severity": "High", "organic_solution": ["step 1", "step 2", "step 3"], "chemical_medicine": ["step 1", "step 2", "step 3"], "explanation": "Brief explanation here...", "prevention_tips": ["tip 1", "tip 2", "tip 3", "tip 4"]}}'
    )

    # ==========================================
    # 1. First Priority: GEMINI API
    # ==========================================
    try:
        print("🔄 Trying Gemini API...")
        gemini_client = genai.Client(api_key=os.environ.get("GEMINI_API_KEY"))
        response = gemini_client.models.generate_content(
            model='gemini-2.0-flash',
            contents=prompt + " Please ensure the response is strictly JSON."
        )
        # Clean any markdown formatting Gemini might add
        clean_json = response.text.replace('```json', '').replace('```', '').strip()
        
        # Verify if it's valid JSON before returning
        json.loads(clean_json) 
        print("✅ Success: Gemini")
        return clean_json
    except Exception as e:
        print(f"⚠️ Gemini failed: {e}")

    # ==========================================
    # 2. Second Priority: OPENROUTER API
    # ==========================================
    try:
        print("🔄 Trying OpenRouter API...")
        headers = {
            "Authorization": f"Bearer {os.environ.get('OPENROUTER_API_KEY')}",
            "Content-Type": "application/json"
        }
        payload = {
            "model": "meta-llama/llama-3.3-70b-instruct", # OpenRouter er popular free/cheap model
            "messages": [{"role": "user", "content": prompt}],
            "response_format": {"type": "json_object"}
        }
        or_response = requests.post("https://openrouter.ai/api/v1/chat/completions", headers=headers, json=payload)
        or_response.raise_for_status()
        
        result_text = or_response.json()['choices'][0]['message']['content']
        print("✅ Success: OpenRouter")
        return result_text
    except Exception as e:
        print(f"⚠️ OpenRouter failed: {e}")

    # ==========================================
    # 3. Third Priority (Brahmastra): GROQ API
    # ==========================================
    try:
        print("🔄 Trying Groq API...")
        groq_client = Groq(api_key=os.environ.get("GROQ_API_KEY"))
        completion = groq_client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"}
        )
        print("✅ Success: Groq")
        return completion.choices[0].message.content
    except Exception as e:
        print(f"❌ Groq failed: {e}")
        
    # ==========================================
    # ALL FAILED (Worst Case Scenario)
    # ==========================================
    return json.dumps({
        "error": "All AI servers (Gemini, OpenRouter, Groq) are currently busy. Please try again in a few minutes."
    })
# ==========================================
# ✉️ BACKGROUND EMAIL PROCESSOR (SMTP -> GOOGLE SCRIPT API)
# ==========================================
def process_email_fallback(user_email, disease, severity, organic, chemical, html_body):
    sender_email = os.environ.get("SENDER_EMAIL")
    sender_password = os.environ.get("SENDER_PASSWORD")
    google_script_url = os.environ.get("GOOGLE_SCRIPT_URL")

    # SMTP er jonno message object (Primary Attempt)
    msg = MIMEMultipart()
    msg['From'] = f"CropHeal AI <{sender_email}>"
    msg['To'] = user_email
    msg['Subject'] = f"🌱 CropHeal AI Diagnosis Report: {disease}"
    msg.attach(MIMEText(html_body, 'html'))

    # ------------------------------------------------
    # ATTEMPT 1: GMAIL SMTP
    # ------------------------------------------------
    try:
        print("🔄 [Email] Attempting SMTP...")
        # Timeout 8 second jate Hugging Face e beshi deri na hoy
        server = smtplib.SMTP('smtp.gmail.com', 587, timeout=8)
        server.starttls()
        server.login(sender_email, sender_password)
        server.send_message(msg)
        server.quit()
        print(f"✅ [Email] Success: Sent via SMTP to {user_email}")
        return # SMTP kaj korle ekhanei sesh
    
    except Exception as e:
        print(f"⚠️ [Email] SMTP Blocked/Failed: {e}")
        print("🔄 [Email] Switching to Google Script API Fallback...")

    # ------------------------------------------------
    # ATTEMPT 2: GOOGLE APPS SCRIPT API (The Ultimate Solution)
    # ------------------------------------------------
    if not google_script_url:
        print("❌ [Email] Google Script URL missing in secrets!")
        return

    try:
        payload = {
            "to": user_email,
            "subject": f"🌱 CropHeal AI Diagnosis Report: {disease}",
            "body": html_body
        }
        
        # Google Script post request pathano
        # Note: requests auto redirect handle kore, tai ekhane problem hobe na
        response = requests.post(google_script_url, json=payload, timeout=20)
        
        # Google Script 200/302 return kore success hole
        if response.status_code == 200:
            print(f"✅ [Email] Success: Sent via Google Script API to {user_email}")
        else:
            print(f"❌ [Email] Google API Error. Status: {response.status_code}")
            
    except Exception as e:
        print(f"❌ [Email] All sending methods failed! Error: {e}")

# --- FLASK ROUTES ---

@app.route('/')
def index():
    from flask import render_template
    return render_template('index.html')

@app.route('/predict', methods=['POST'])
def predict():
    if 'file' not in request.files:
        return jsonify({'error': 'No file uploaded'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No selected file'}), 400

    filename = str(uuid.uuid4()) + ".jpg"
    filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
    file.save(filepath)

    predicted_class, confidence = predict_plant_disease(filepath)
    formatted_disease = predicted_class.replace('_', ' ').title()

    severity = "Low" if "healthy" in predicted_class.lower() else "High"

    if "Error" not in predicted_class:
        suggestion_json_str = get_treatment_suggestion(predicted_class)
        
        print(f"\n--- DEBUG GROQ RESPONSE ---\n{suggestion_json_str}\n-----------------------------\n")
        
        try:
            suggestions = json.loads(suggestion_json_str)
            
            if "severity" in suggestions:
                severity = suggestions["severity"]

            if "error" in suggestions:
                suggestions = {
                    "organic_solution": ["⚠️ API Error:", suggestions["error"], "Please check your Groq API key."],
                    "chemical_medicine": ["⚠️ API Error:", suggestions["error"], "Please check your Groq API key."]
                }
        except:
            suggestions = {"organic_solution": ["Error parsing JSON from Groq"], "chemical_medicine": ["Error parsing JSON from Groq"]}
    else:
        formatted_disease = "Detection Failed"
        suggestions = {"organic_solution": [], "chemical_medicine": []}
        severity = "High"

    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        except:
            pass

    return jsonify({
        'disease': formatted_disease,
        'confidence': confidence,
        'severity': severity, 
        'organic': suggestions.get('organic_solution', []),
        'chemical': suggestions.get('chemical_medicine', []),
        'explanation': suggestions.get('explanation', 'No explanation available.'),
        'prevention': suggestions.get('prevention_tips', [])
    })


@app.route('/send_email', methods=['POST'])
def send_email():
    data = request.json
    user_email = data.get('email')
    disease = data.get('disease', 'Unknown Disease')
    severity = data.get('severity', 'Unknown')
    organic = data.get('organic', [])
    chemical = data.get('chemical', [])

    if not user_email:
        return jsonify({'error': 'Email is required.'}), 400

    # HTML Template (Apnar banano sundor design-ta ekhane thakbe)
    # severity_color, organic_html, etc. generate korar code thakbe
    # (Ami dhorchi apni html_body ta toiri korchen ager moto)
    # ... (Ager moto html_body generator code-tuku ekhane thakbe) ...
    # Dynamic styling values
    severity_color = '#E53935' if severity.lower() == 'high' else '#FFA726' if severity.lower() == 'medium' else '#2E7D32'
    current_date = datetime.datetime.now().strftime("%d %B, %Y")
    report_id = "CH-" + str(uuid.uuid4().hex[:6].upper())

    # Email List Items
    organic_html = "".join([f"<li style='margin-bottom: 8px;'>{item}</li>" for item in organic])
    chemical_html = "".join([f"<li style='margin-bottom: 8px;'>{item}</li>" for item in chemical])

    # 🎨 PREMIUM EMAIL HTML TEMPLATE
    html_body = f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
    </head>
    <body style="margin: 0; padding: 0; font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; background-color: #f4f7f6;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; background-color: #ffffff; margin: 30px auto; border: 1px solid #e0e0e0; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 15px rgba(0,0,0,0.05);">
            
            <tr>
                <td style="background-color: #2E7D32; padding: 35px 20px; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; font-size: 26px; letter-spacing: 1px;">🌿 CropHeal AI</h1>
                    <p style="color: #c8e6c9; margin: 5px 0 0 0; font-size: 14px;">Plant Disease Diagnostic Report</p>
                </td>
            </tr>
            
            <tr>
                <td style="padding: 15px 25px; background-color: #F4F9F4; border-bottom: 2px solid #66BB6A;">
                    <table border="0" cellpadding="0" cellspacing="0" width="100%" style="font-size: 13px; color: #263238;">
                        <tr>
                            <td align="left"><strong>Report ID:</strong> {report_id}</td>
                            <td align="right"><strong>Date:</strong> {current_date}</td>
                        </tr>
                    </table>
                </td>
            </tr>

            <tr>
                <td style="padding: 30px 25px;">
                    <h2 style="color: #2E7D32; font-size: 18px; border-bottom: 1px solid #eeeeee; padding-bottom: 10px; margin-top: 0;">🔬 AI Diagnosis Result</h2>
                    
                    <table border="0" cellpadding="12" cellspacing="0" width="100%" style="background-color: #F8FAF8; border-radius: 6px; border-left: 4px solid #2E7D32; margin-bottom: 30px;">
                        <tr>
                            <td width="40%" style="color: #555555; font-size: 14px;"><strong>Disease Detected:</strong></td>
                            <td width="60%" style="color: #2E7D32; font-weight: bold; font-size: 16px;">{disease}</td>
                        </tr>
                        <tr>
                            <td style="color: #555555; font-size: 14px;"><strong>Severity Level:</strong></td>
                            <td style="font-weight: bold; font-size: 15px; color: {severity_color};">{severity}</td>
                        </tr>
                    </table>

                    <h2 style="color: #2E7D32; font-size: 18px; border-bottom: 1px solid #eeeeee; padding-bottom: 10px;">💊 Treatment Recommendation</h2>
                    
                    <div style="background-color: #F4F9F4; border: 1px solid #C8E6C9; border-radius: 6px; padding: 18px; margin-bottom: 15px;">
                        <h3 style="color: #2E7D32; margin-top: 0; font-size: 16px;">🌿 Organic Treatment</h3>
                        <ul style="margin: 0; padding-left: 20px; color: #333333; font-size: 14px; line-height: 1.6;">
                            {organic_html}
                        </ul>
                    </div>

                    <div style="background-color: #FFF8F8; border: 1px solid #FFCDD2; border-radius: 6px; padding: 18px; margin-bottom: 20px;">
                        <h3 style="color: #E53935; margin-top: 0; font-size: 16px;">🧪 Chemical Treatment</h3>
                        <ul style="margin: 0; padding-left: 20px; color: #333333; font-size: 14px; line-height: 1.6;">
                            {chemical_html}
                        </ul>
                    </div>
                </td>
            </tr>

            <tr>
                <td style="background-color: #eceff1; padding: 25px 20px; text-align: center; font-size: 12px; color: #546e7a; border-top: 1px solid #cfd8dc;">
                    <p style="margin: 0 0 8px 0; font-size: 14px;"><strong>CropHeal AI System</strong></p>
                    <p style="margin: 0 0 15px 0;">AI Powered Smart Agriculture</p>
                    <div style="background-color: #ffcdd2; color: #c62828; padding: 10px; border-radius: 4px; font-size: 11px;">
                        ⚠️ This report is AI-generated and should be verified by an agricultural expert before large-scale treatment application.
                    </div>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """
    # Background-e thread start kora
    thread = threading.Thread(
        target=process_email_fallback, 
        args=(user_email, disease, severity, organic, chemical, html_body)
    )
    thread.start()

    return jsonify({'success': 'Analysis report is being sent to your inbox!'})
if __name__ == "__main__":
    # Check if we should run in debug mode
    debug_mode = os.getenv("FLASK_DEBUG", "True").lower() in ("true", "1", "t")
    
    port = int(os.getenv("PORT", 7860))

    if debug_mode:
        print(f"Running in Development Mode on port {port}")
        app.run(host="0.0.0.0", port=port, debug=True)
    else:
        print(f"Running in Production Mode (Waitress) on port {port}")
        from waitress import serve
        serve(app, host="0.0.0.0", port=port)