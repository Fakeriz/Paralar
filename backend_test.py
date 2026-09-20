#!/usr/bin/env python3
"""
Backend API Test Suite for Paralar
Tests all backend endpoints at http://localhost:3000/api
"""

import requests
import json
import sys
import base64
from io import BytesIO
from PIL import Image

BASE_URL = "http://localhost:3000/api"

def print_test_header(test_name):
    print(f"\n{'='*80}")
    print(f"TEST: {test_name}")
    print(f"{'='*80}")

def print_result(success, message):
    status = "✅ PASS" if success else "❌ FAIL"
    print(f"{status}: {message}")
    return success

def test_health():
    """Test GET /api/health endpoint"""
    print_test_header("GET /api/health")
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        if not data.get('ok'):
            return print_result(False, f"Expected ok:true, got {data}")
        
        if data.get('app') != 'Paralar':
            return print_result(False, f"Expected app:'Paralar', got {data.get('app')}")
        
        return print_result(True, f"Health check passed: {data}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")

def test_rates():
    """Test GET /api/rates endpoint"""
    print_test_header("GET /api/rates")
    try:
        response = requests.get(f"{BASE_URL}/rates", timeout=10)
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text[:500]}...")
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        
        # Check required fields
        if data.get('base') != 'USD':
            return print_result(False, f"Expected base:'USD', got {data.get('base')}")
        
        if 'rates' not in data:
            return print_result(False, "Missing 'rates' field")
        
        rates = data['rates']
        required_currencies = ['USD', 'MYR', 'IDR', 'TRY', 'EUR']
        for curr in required_currencies:
            if curr not in rates:
                return print_result(False, f"Missing currency: {curr}")
        
        if rates.get('USD') != 1:
            return print_result(False, f"Expected USD rate to be 1, got {rates.get('USD')}")
        
        if 'source' not in data or data['source'] not in ['live', 'fallback']:
            return print_result(False, f"Invalid source: {data.get('source')}")
        
        return print_result(True, f"Rates check passed. Source: {data['source']}, Currencies: {len(rates)}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")

def test_ai_parse_malay():
    """Test POST /api/ai/parse with Malay text"""
    print_test_header("POST /api/ai/parse - Malay transaction")
    try:
        payload = {
            "text": "Nasi lemak lima ringgit pakai TnG",
            "homeCurrency": "IDR",
            "language": "ms",
            "accounts": ["Main account", "TnG"],
            "categories": ["food", "transport", "shopping", "bills", "salary", "other"]
        }
        
        response = requests.post(
            f"{BASE_URL}/ai/parse",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        
        # Check required fields
        if data.get('type') != 'expense':
            return print_result(False, f"Expected type:'expense', got {data.get('type')}")
        
        # Amount should be around 5
        amount = data.get('amount', 0)
        if not (4 <= amount <= 6):
            return print_result(False, f"Expected amount ~5, got {amount}")
        
        if data.get('currency') != 'MYR':
            return print_result(False, f"Expected currency:'MYR', got {data.get('currency')}")
        
        if data.get('category') != 'food':
            return print_result(False, f"Expected category:'food', got {data.get('category')}")
        
        if data.get('payment_method') != 'qr':
            return print_result(False, f"Expected payment_method:'qr', got {data.get('payment_method')}")
        
        if 'TnG' not in str(data.get('account_name', '')):
            return print_result(False, f"Expected account_name to mention TnG, got {data.get('account_name')}")
        
        if 'confidence' not in data or not isinstance(data['confidence'], (int, float)):
            return print_result(False, f"Missing or invalid confidence: {data.get('confidence')}")
        
        return print_result(True, f"Parse Malay passed: {amount} {data['currency']} {data['category']} via {data['payment_method']}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")

def test_ai_parse_english():
    """Test POST /api/ai/parse with English text"""
    print_test_header("POST /api/ai/parse - English income")
    try:
        payload = {
            "text": "got paid 8 million rupiah salary"
        }
        
        response = requests.post(
            f"{BASE_URL}/ai/parse",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        
        if data.get('type') != 'income':
            return print_result(False, f"Expected type:'income', got {data.get('type')}")
        
        if data.get('currency') != 'IDR':
            return print_result(False, f"Expected currency:'IDR', got {data.get('currency')}")
        
        # Amount should be around 8000000
        amount = data.get('amount', 0)
        if not (7000000 <= amount <= 9000000):
            return print_result(False, f"Expected amount ~8000000, got {amount}")
        
        category = data.get('category', '')
        if category not in ['salary', 'income', 'other']:
            print(f"Note: Category is '{category}', expected 'salary' but accepting it")
        
        return print_result(True, f"Parse English passed: {amount} {data['currency']} {data['type']}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")

def test_ai_parse_missing_text():
    """Test POST /api/ai/parse with missing text"""
    print_test_header("POST /api/ai/parse - Missing text (400 expected)")
    try:
        payload = {}
        
        response = requests.post(
            f"{BASE_URL}/ai/parse",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 400:
            return print_result(False, f"Expected 400, got {response.status_code}")
        
        data = response.json()
        if 'error' not in data:
            return print_result(False, f"Expected error field in response")
        
        return print_result(True, f"Correctly returned 400 with error: {data['error']}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")

def test_ai_coach_valid():
    """Test POST /api/ai/coach with valid request"""
    print_test_header("POST /api/ai/coach - Valid request")
    try:
        payload = {
            "messages": [
                {"role": "user", "content": "How can I save 20% of my income?"}
            ],
            "language": "en",
            "context": {
                "homeCurrency": "IDR",
                "monthIncome": 8000000,
                "monthSpending": 6500000
            }
        }
        
        response = requests.post(
            f"{BASE_URL}/ai/coach",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        
        if 'reply' not in data or not data['reply']:
            return print_result(False, f"Missing or empty 'reply' field")
        
        if 'model' not in data or not data['model']:
            return print_result(False, f"Missing or empty 'model' field")
        
        return print_result(True, f"Coach replied with {len(data['reply'])} chars using model {data['model']}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")

def test_ai_coach_missing_messages():
    """Test POST /api/ai/coach with missing messages"""
    print_test_header("POST /api/ai/coach - Missing messages (400 expected)")
    try:
        payload = {}
        
        response = requests.post(
            f"{BASE_URL}/ai/coach",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 400:
            return print_result(False, f"Expected 400, got {response.status_code}")
        
        data = response.json()
        if 'error' not in data:
            return print_result(False, f"Expected error field in response")
        
        return print_result(True, f"Correctly returned 400 with error: {data['error']}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")

def test_ai_ocr_missing_image():
    """Test POST /api/ai/ocr with missing image"""
    print_test_header("POST /api/ai/ocr - Missing image (400 expected)")
    try:
        payload = {}
        
        response = requests.post(
            f"{BASE_URL}/ai/ocr",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 400:
            return print_result(False, f"Expected 400, got {response.status_code}")
        
        data = response.json()
        if 'error' not in data or 'image is required' not in data['error']:
            return print_result(False, f"Expected 'image is required' error")
        
        return print_result(True, f"Correctly returned 400 with error: {data['error']}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")

def test_ai_ocr_with_image():
    """Test POST /api/ai/ocr with a synthetic receipt image"""
    print_test_header("POST /api/ai/ocr - With base64 image")
    try:
        # Create a simple receipt-like image
        img = Image.new('RGB', (400, 600), color='white')
        from PIL import ImageDraw, ImageFont
        draw = ImageDraw.Draw(img)
        
        # Draw receipt text
        text_lines = [
            "MINI MART RECEIPT",
            "Date: 2024-01-15",
            "Receipt: RCP001234",
            "",
            "Milk         RM 5.50",
            "Bread        RM 3.20",
            "Eggs         RM 6.80",
            "",
            "Subtotal:   RM 15.50",
            "Tax:        RM  0.93",
            "Total:      RM 16.43",
            "",
            "Payment: Cash",
            "Thank you!"
        ]
        
        y = 20
        for line in text_lines:
            draw.text((20, y), line, fill='black')
            y += 30
        
        # Convert to base64
        buffered = BytesIO()
        img.save(buffered, format="PNG")
        img_base64 = base64.b64encode(buffered.getvalue()).decode('utf-8')
        
        payload = {
            "imageBase64": img_base64
        }
        
        response = requests.post(
            f"{BASE_URL}/ai/ocr",
            json=payload,
            headers={"Content-Type": "application/json"},
            timeout=30
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code != 200:
            return print_result(False, f"Expected 200, got {response.status_code}")
        
        data = response.json()
        
        if 'receipt' not in data:
            return print_result(False, f"Missing 'receipt' field")
        
        receipt = data['receipt']
        
        # Check structure
        required_fields = ['merchant', 'category', 'total', 'items', 'confidence']
        for field in required_fields:
            if field not in receipt:
                return print_result(False, f"Missing field in receipt: {field}")
        
        if 'model' not in data:
            return print_result(False, f"Missing 'model' field")
        
        return print_result(True, f"OCR passed: merchant={receipt.get('merchant')}, total={receipt.get('total')}, items={len(receipt.get('items', []))}, model={data['model']}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")

def test_ai_transcribe_missing_file():
    """Test POST /api/ai/transcribe with missing file"""
    print_test_header("POST /api/ai/transcribe - Missing file (400 expected)")
    try:
        # Test with empty JSON
        response = requests.post(
            f"{BASE_URL}/ai/transcribe",
            json={},
            headers={"Content-Type": "application/json"},
            timeout=10
        )
        
        print(f"Status Code: {response.status_code}")
        print(f"Response: {response.text}")
        
        # Should fail because it expects multipart/form-data
        if response.status_code == 400:
            data = response.json()
            if 'error' in data and 'file' in data['error'].lower():
                return print_result(True, f"Correctly returned 400 with error: {data['error']}")
        
        # Try with empty multipart
        response = requests.post(
            f"{BASE_URL}/ai/transcribe",
            files={},
            timeout=10
        )
        
        print(f"Status Code (multipart): {response.status_code}")
        print(f"Response (multipart): {response.text}")
        
        if response.status_code != 400:
            return print_result(False, f"Expected 400, got {response.status_code}")
        
        data = response.json()
        if 'error' not in data or 'file' not in data['error'].lower():
            return print_result(False, f"Expected 'file is required' error")
        
        return print_result(True, f"Correctly returned 400 with error: {data['error']}")
    except Exception as e:
        return print_result(False, f"Exception: {str(e)}")

def main():
    print("\n" + "="*80)
    print("PARALAR BACKEND API TEST SUITE")
    print("Base URL: " + BASE_URL)
    print("="*80)
    
    results = []
    
    # Run all tests
    results.append(("GET /api/health", test_health()))
    results.append(("GET /api/rates", test_rates()))
    results.append(("POST /api/ai/parse (Malay)", test_ai_parse_malay()))
    results.append(("POST /api/ai/parse (English)", test_ai_parse_english()))
    results.append(("POST /api/ai/parse (Missing text)", test_ai_parse_missing_text()))
    results.append(("POST /api/ai/coach (Valid)", test_ai_coach_valid()))
    results.append(("POST /api/ai/coach (Missing messages)", test_ai_coach_missing_messages()))
    results.append(("POST /api/ai/ocr (Missing image)", test_ai_ocr_missing_image()))
    results.append(("POST /api/ai/ocr (With image)", test_ai_ocr_with_image()))
    results.append(("POST /api/ai/transcribe (Missing file)", test_ai_transcribe_missing_file()))
    
    # Summary
    print("\n" + "="*80)
    print("TEST SUMMARY")
    print("="*80)
    
    passed = sum(1 for _, result in results if result)
    total = len(results)
    
    for test_name, result in results:
        status = "✅ PASS" if result else "❌ FAIL"
        print(f"{status}: {test_name}")
    
    print(f"\n{passed}/{total} tests passed")
    
    if passed == total:
        print("\n🎉 All tests passed!")
        sys.exit(0)
    else:
        print(f"\n⚠️  {total - passed} test(s) failed")
        sys.exit(1)

if __name__ == "__main__":
    main()
