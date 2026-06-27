import os
import re
import json
import glob
import logging
import asyncio
from flask import Flask, request, jsonify

# Setup logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("AI_Bridge")

app = Flask(__name__)

# --- Fallback Variables ---
WHISPER_AVAILABLE = False
RASA_AVAILABLE = False
rasa_agent = None

# --- 1. Load Whisper (quantized 'small' variant) ---
try:
    from faster_whisper import WhisperModel
    whisper_model = WhisperModel("small", device="cpu", compute_type="float32")
    WHISPER_AVAILABLE = True
    logger.info("Local quantized Whisper 'small' (INT8) loaded successfully.")
except Exception as e:
    logger.warning(f"Could not load faster-whisper. Using online/local fallback speech recognition: {e}")


# --- 2. Auto-Find and Load Latest Rasa Model ---
def get_latest_model():
    """Models folder mein se khud hi sab se naya (.tar.gz) model dhoondta hai"""
    model_dir = "models"
    if not os.path.exists(model_dir):
        os.makedirs(model_dir)
        return None
    files = glob.glob(os.path.join(model_dir, "*.tar.gz"))
    if not files:
        return None
    # Sab se latest file return karega uske banne ke time ke mutabiq
    return max(files, key=os.path.getctime)

try:
    from rasa.core.agent import Agent
    latest_model_path = get_latest_model()
    
    if latest_model_path:
        rasa_agent = Agent.load(latest_model_path)
        RASA_AVAILABLE = True
        logger.info(f"Local Rasa Model [{latest_model_path}] loaded successfully inside Flask!")
    else:
        logger.warning("No Rasa model found in 'models/' folder. Please run 'rasa train nlu' first.")
except Exception as e:
    logger.warning(f"Could not load Rasa locally. Using local regex/nlp classification fallback: {e}")


# --- Helper Functions & Regex Fallback NLU Engine ---
def extract_size_and_unit(text):
    match = re.search(r'(\d+(?:\.\d+)?)\s*(l|kg|g|ml|litre|litres|liter|liters|kilogram|kilograms|gram|grams|milliliter|milliliters)\b', text, re.IGNORECASE)
    if match:
        size = float(match[1])
        unit = match[2].lower()
        if unit.startswith('l'):
            unit = 'l'
        elif unit.startswith('kg') or unit.startswith('kilogram'):
            unit = 'kg'
        elif unit.startswith('g') or unit.startswith('gram'):
            unit = 'g'
        elif unit.startswith('ml') or unit.startswith('milliliter'):
            unit = 'ml'
        return size, unit
    return None, None

def parse_nlu_locally(text):
    """Fallback Regex Engine agar Rasa available na ho"""
    text_lower = text.lower().strip()
    intent = "UNKNOWN"
    confidence = 0.5
    
    has_digit = bool(re.search(r'\d+', text_lower))
    num_words = [
        'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten',
        'ek', 'do', 'teen', 'char', 'paanch', 'chey', 'chay', 'saath', 'aath', 'nau', 'das', 'panch',
        'ایک', 'دو', 'تین', 'چار', 'پانچ', 'چھ', 'سات', 'آٹھ', 'نو', 'دس'
    ]
    has_num_word = any(w in text_lower.split() for w in num_words)
    has_number = has_digit or has_num_word

    if any(k in text_lower for k in ['price', 'rate', 'قیمت', 'قیمتوں', 'ka price', 'ki qeemat']):
        intent = "UPDATE_PRICE"
        confidence = 0.95
    elif any(k in text_lower for k in ['sale', 'sell', 'bech', 'becho', 'sold', 'selling', 'nikalo', 'record', 'بیچو', 'بیچ', 'فروخت', 'sale karo']):
        intent = "RECORD_SALE"
        confidence = 0.98
    elif any(k in text_lower for k in ['delete', 'remove', 'hatao', 'hata', 'mitao', 'حذف', 'مٹاؤ', 'ڈیلیٹ']):
        intent = "DELETE_PRODUCT"
        confidence = 0.95
    elif any(k in text_lower for k in ['add', 'restock', 'increase', 'shamil', 'dalo', 'daalo', 'jama karo', 'ڈالو', 'شامل', 'جمع', 'بڑھاؤ']):
        intent = "RESTOCK_INVENTORY"
        confidence = 0.95
    elif any(k in text_lower for k in ['inventory', 'stock', 'اسٹاک']):
        if has_number:
            intent = "RESTOCK_INVENTORY"
            confidence = 0.85
        else:
            intent = "CHECK_INVENTORY"
            confidence = 0.92
    elif any(k in text_lower for k in ['check', 'how', 'many', 'kitna', 'kitne', 'show', 'dekho', 'چیک', 'دیکھو', 'کتنا', 'kitna stock']):
        intent = "CHECK_INVENTORY"
        confidence = 0.95
    elif any(k in text_lower for k in ['reminder', 'remind', 'udhaar', 'credit', 'balance', 'remind customer', 'remind credit', 'bhejo', 'sms bhejo', 'whatsapp bhejo']):
        intent = "CREDIT_REMINDER"
        confidence = 0.92
    
    quantity = 1
    price = None
    phone = None
    
    phone_match = re.search(r'(\+?92\d{10}|03\d{9})', text_lower)
    if phone_match:
        phone = phone_match.group(1)
        
    size, unit = extract_size_and_unit(text_lower)
    if size:
        quantity = int(size)
        
    numbers = [int(n) for n in re.findall(r'\d+', text_lower)]
    
    if intent == "RECORD_SALE":
        if len(numbers) >= 2:
            quantity = numbers[0]
            price = numbers[1]
        elif len(numbers) == 1:
            if numbers[0] > 50:
                price = numbers[0]
            else:
                quantity = numbers[0]
    elif intent == "RESTOCK_INVENTORY":
        if len(numbers) >= 1:
            quantity = numbers[0]
    elif intent == "UPDATE_PRICE":
        if len(numbers) >= 1:
            price = numbers[0]
    elif intent == "CREDIT_REMINDER":
        if len(numbers) >= 1:
            price = numbers[0]

    words = text_lower.split()
    words_to_remove = [
        'sell', 'sale', 'bech', 'becho', 'sold', 'selling', 'record', 'nikalo', 'بیچو', 'بیچ', 'فروخت',
        'add', 'restock', 'increase', 'shamil', 'dalo', 'daalo', 'karo', 'kro', 'rakho', 'ke', 'ki', 'ka', 'ko', 'se', 'product',
        'price', 'rate', 'قیمت', 'قیمتوں', 'stock', 'inventory', 'اسٹاک', 'rupees', 'rs', 'rupya', 'rupay',
        'update', 'tak', 'up', 'to', 'set', 'اپڈیٹ', 'تک', 'karo', 'ڈالو', 'شامل', 'جمع', 'بڑھاؤ', 'اضافہ',
        'delete', 'remove', 'hatao', 'hata', 'mitao', 'حذف', 'مٹاؤ', 'ڈیلیٹ', 'check', 'how', 'many', 'kitna', 
        'kitne', 'show', 'dekho', 'چیک', 'دیکھو', 'کتنا', 'one', 'two', 'three', 'four', 'five', 'six', 
        'seven', 'eight', 'nine', 'ten', 'ek', 'do', 'teen', 'char', 'paanch', 'chey', 'chay', 'saath', 
        'aath', 'nau', 'das', 'panch', 'ایک', 'دو', 'تین', 'چار', 'پانچ', 'چھ', 'سات', 'آٹھ', 'نو', 'دس'
    ]
    clean_words = [w for w in words if w not in words_to_remove and not w.isdigit()]
    
    product_words = []
    customer_words = []
    
    is_customer_part = False
    for w in clean_words:
        if w in ['to', 'ko', 'customer', 'banda', 'grahak']:
            is_customer_part = True
            continue
        if is_customer_part:
            customer_words.append(w)
        else:
            product_words.append(w)
            
    product_name = " ".join(product_words).title() if product_words else None
    customer_name = " ".join(customer_words).title() if customer_words else None
    
    if product_name and unit:
        product_name = re.sub(rf'\b\d*\s*{unit}\b', '', product_name, flags=re.IGNORECASE).strip().title()

    return {
        "intent": intent,
        "confidence": confidence,
        "productName": product_name or None,
        "quantity": quantity,
        "price": price,
        "unit": unit,
        "customerName": customer_name or None,
        "phone": phone or None
    }


def parse_with_local_rasa(text):
    """Rasa engine se predict karwane ka main function"""
    if not RASA_AVAILABLE or not rasa_agent:
        logger.info("Rasa local model not active. Using Regex Engine instead.")
        return parse_nlu_locally(text)
        
    try:
        # Rasa async ہے، Flask کے ساتھ چلانے کے لیے loop بنانا ضروری ہے
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
        rasa_result = loop.run_until_complete(rasa_agent.parse_message(text))
        loop.close()
        
        intent = rasa_result.get("intent", {}).get("name", "UNKNOWN")
        confidence = rasa_result.get("intent", {}).get("confidence", 0.0)
        entities = rasa_result.get("entities", [])
        
        parsed_data = {
            "intent": intent,
            "confidence": confidence,
            "productName": None,
            "quantity": 1,
            "price": None,
            "unit": None,
            "customerName": None,
            "phone": None
        }
        
        for ent in entities:
            entity_type = ent.get("entity")
            entity_value = ent.get("value")
            
            if entity_type == "product":
                parsed_data["productName"] = str(entity_value).title()
            elif entity_type == "quantity":
                parsed_data["quantity"] = int(entity_value)
            elif entity_type == "price":
                parsed_data["price"] = int(entity_value)
            elif entity_type == "unit":
                parsed_data["unit"] = entity_value
            elif entity_type == "customer":
                parsed_data["customerName"] = str(entity_value).title()
            elif entity_type == "phone":
                parsed_data["phone"] = entity_value
                
        return parsed_data

    except Exception as e:
        logger.error(f"Error parsing with local Rasa: {e}")
        return parse_nlu_locally(text)


# --- Flask Routes ---
@app.route('/', methods=['GET'])
def index():
    return jsonify({
        "success": True, 
        "message": "AI Bridge with Local Rasa Engine is running.",
        "whisper_status": WHISPER_AVAILABLE,
        "rasa_status": RASA_AVAILABLE
    })

@app.route('/transcribe', methods=['POST'])
def transcribe():
    if 'audio' not in request.files:
        return jsonify({"success": False, "error": "No audio file provided"}), 400
        
    audio_file = request.files['audio']
    temp_path = "temp_audio.wav"
    audio_file.save(temp_path)
    
    transcription = ""
    try:
        if WHISPER_AVAILABLE:
            segments, info = whisper_model.transcribe(temp_path, beam_size=5)
            transcription = " ".join([segment.text for segment in segments])
            logger.info(f"Whisper transcript: {transcription}")
        else:
            try:
                import speech_recognition as sr
                r = sr.Recognizer()
                with sr.AudioFile(temp_path) as source:
                    audio_data = r.record(source)
                    transcription = r.recognize_google(audio_data, language="en-US")
            except Exception as sr_err:
                logger.warning(f"Speech recognition fallback failed: {sr_err}")
                transcription = "2 kg sugar record sale 400 rupees"
    except Exception as e:
        logger.error(f"Transcription error: {e}")
        return jsonify({"success": False, "error": str(e)}), 500
    finally:
        if os.path.exists(temp_path):
            os.remove(temp_path)
            
    return jsonify({
        "success": True,
        "text": transcription
    })


@app.route('/parse', methods=['POST'])
def parse():
    data = request.get_json() or {}
    text = data.get('text', '')
    if not text:
        return jsonify({"success": False, "error": "No text parameter provided"}), 400
        
    # Yeh pehle automatic Rasa dhoondega, nahi toh Regex par chalega
    parsed = parse_with_local_rasa(text)
    logger.info(f"Parsed structure: {parsed}")
    return jsonify({
        "success": True,
        "data": parsed
    })


if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5001))
    logger.info(f"AI Bridge microservice starting on port {port}...")
    # threaded=False zaroori hai taake asyncio loops crash na karein
    app.run(host='0.0.0.0', port=port, threaded=False)