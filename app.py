import os
import numpy as np
import json
from flask import Flask, request, jsonify
from werkzeug.utils import secure_filename
from dotenv import load_dotenv
from tensorflow.keras import layers, models
from tensorflow.keras.applications import MobileNetV2
from google import genai
import uuid

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

# Load model globally so it doesn't load on every request (faster)
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
        # Load, resize, convert to array, and add batch dimension (Using updated Keras 3 utils)
        from tensorflow.keras.utils import load_img, img_to_array
        img = load_img(image_path, target_size=(224, 224))
        img_array = img_to_array(img)
        img_array = np.expand_dims(img_array, axis=0)
    except Exception as e:
        print(f"❌ IMAGE PROCESSING ERROR: {e}")
        return f"Error processing image: {e}", 0

    try:
        # Predict the class
        predictions = model.predict(img_array)
        predicted_index = np.argmax(predictions[0])
        
        # Calculate confidence percentage
        confidence = float(predictions[0][predicted_index]) * 100
        predicted_class = CLASS_NAMES[predicted_index]

        return predicted_class, round(confidence, 1)
    except Exception as e:
        print(f"❌ MODEL PREDICTION ERROR: {e}")
        return f"Error during prediction: {e}", 0



def get_treatment_suggestion(predicted_class):
    """Parses the prediction and fetches a structured JSON suggestion from Gemini."""
    if 'healthy' in predicted_class.lower():
        return json.dumps({
            "severity": "Low",
            "organic_solution": ["Keep watering regularly.", "Ensure proper sunlight.", "No treatment needed."],
            "chemical_medicine": ["None required.", "Avoid unnecessary fertilizers.", "Keep observing the plant."]
        })

    parts = predicted_class.split('_', 1)
    if len(parts) > 1:
        plant_name = parts[0].capitalize()
        disease_name = parts[1].replace('_', ' ')
    else:
        plant_name = "Plant"
        disease_name = predicted_class

    api_key = os.environ.get("API")

    try:
        client = genai.Client(api_key=api_key)
    except Exception as e:
         return json.dumps({"error": f"Error initializing Gemini client: {e}"})

    # 🟢 PROMPT UPDATE: Ebar amra Gemini ke Severity o dite bolchi
    prompt = (
        f"A farmer's {plant_name} plant has been diagnosed with {disease_name}. "
        f"Provide exactly 3 short, actionable steps for an organic solution, and exactly 3 short, actionable steps for a chemical medicine. "
        f"Also, assess the general risk severity of this disease to the crop yield as 'Low', 'Medium', or 'High'. "
        f"Return ONLY a valid JSON object with no markdown formatting, no code blocks, and no extra text. "
        f"The JSON must have exactly this structure: "
        f'{{"severity": "High", "organic_solution": ["step 1", "step 2", "step 3"], "chemical_medicine": ["step 1", "step 2", "step 3"]}}'
    )

    try:
        response = client.models.generate_content(
            model='gemini-2.5-flash',
            contents=prompt
        )
        
        clean_json = response.text.replace('```json', '').replace('```', '').strip()
        parsed_json = json.loads(clean_json) 
        return json.dumps(parsed_json) 

    except Exception as e:
        return json.dumps({"error": f"Error fetching suggestion from Gemini: {e}"})
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

    # 1. Get Prediction & Confidence
    predicted_class, confidence = predict_plant_disease(filepath)
    
    # 2. Format Disease Name
    formatted_disease = predicted_class.replace('_', ' ').title()

    # 3. Default severity just in case
    severity = "Low" if "healthy" in predicted_class.lower() else "High"

    # 4. Get Treatments from Gemini & Extract Severity dynamically
    if "Error" not in predicted_class:
        suggestion_json_str = get_treatment_suggestion(predicted_class)
        
        print(f"\n--- DEBUG GEMINI RESPONSE ---\n{suggestion_json_str}\n-----------------------------\n")
        
        try:
            suggestions = json.loads(suggestion_json_str)
            
            # 🟢 EKHANE GEMINI THEKE SEVERITY TA BER KORE NEWA HOCHHE
            if "severity" in suggestions:
                severity = suggestions["severity"]

            if "error" in suggestions:
                suggestions = {
                    "organic_solution": ["⚠️ Gemini API Error:", suggestions["error"], "Please check your key."],
                    "chemical_medicine": ["⚠️ Gemini API Error:", suggestions["error"], "Please check your key."]
                }
        except:
            suggestions = {"organic_solution": ["Error parsing JSON from Gemini"], "chemical_medicine": ["Error parsing JSON from Gemini"]}
    else:
        formatted_disease = "Detection Failed"
        suggestions = {"organic_solution": [], "chemical_medicine": []}
        severity = "High"

    if os.path.exists(filepath):
        try:
            os.remove(filepath)
        except:
            pass

    # Return everything to the frontend
    return jsonify({
        'disease': formatted_disease,
        'confidence': confidence,
        'severity': severity, # 🟢 Ei dynamic severity ebar frontend e jabe
        'organic': suggestions.get('organic_solution', []),
        'chemical': suggestions.get('chemical_medicine', [])
    })
if __name__ == '__main__':
    app.run(debug=True)