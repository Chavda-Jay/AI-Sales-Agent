"""
Step 0: Language Quality Audit
Test 8 Indian languages via /api/chat to check if the LLM replies in the same script.
"""
import json
import urllib.request
import time

TESTS = [
    ("Gujarati",   "aa product ni kimmat shun chhe? mane janvu chhe"),
    ("Marathi",    "ya utpadanachi kimmat kay aahe?"),
    ("Tamil",      "indha thayarippin vilai enna?"),
    ("Telugu",     "ee utpatti dhara entha?"),
    ("Kannada",    "ee utpannada bele eshtu?"),
    ("Malayalam",  "ee ulpannatthinte vila ethra?"),
    ("Bengali",    "ei ponyer daam koto?"),
    ("Punjabi",    "is utpaad di keemat ki hai?"),
]

# Also test actual scripts (native unicode)
TESTS_NATIVE = [
    ("Gujarati-Script",   "\u0a86 \u0aaa\u0acd\u0ab0\u0acb\u0aa1\u0a95\u0acd\u0a9f\u0aa8\u0ac0 \u0a95\u0abf\u0a82\u0aae\u0aa4 \u0ab6\u0ac1\u0a82 \u0a9b\u0ac7?"),
    ("Marathi-Script",    "\u092f\u093e \u0909\u0924\u094d\u092a\u093e\u0926\u0928\u093e\u091a\u0940 \u0915\u093f\u0902\u092e\u0924 \u0915\u093e\u092f \u0906\u0939\u0947?"),
    ("Tamil-Script",      "\u0b87\u0ba8\u0bcd\u0ba4 \u0ba4\u0baf\u0bbe\u0bb0\u0bbf\u0baa\u0bcd\u0baa\u0bbf\u0ba9\u0bcd \u0bb5\u0bbf\u0bb2\u0bc8 \u0b8e\u0ba9\u0bcd\u0ba9?"),
    ("Telugu-Script",     "\u0c08 \u0c09\u0c24\u0c4d\u0c2a\u0c24\u0c4d\u0c24\u0c3f \u0c27\u0c30 \u0c0e\u0c02\u0c24?"),
    ("Bengali-Script",    "\u098f\u0987 \u09aa\u09a3\u09cd\u09af\u09c7\u09b0 \u09a6\u09be\u09ae \u0995\u09a4?"),
]

with open("language_audit_results.txt", "w", encoding="utf-8") as f:
    # First test romanized versions (through /api/chat)
    f.write("=" * 70 + "\n")
    f.write("PART 1: ROMANIZED SCRIPT TESTS (via /api/chat)\n")
    f.write("=" * 70 + "\n")
    
    for lang, msg in TESTS:
        cust_id = f"lang-test-{lang.lower()}-{int(time.time())}"
        f.write(f"\n{'='*60}\n")
        f.write(f"LANGUAGE: {lang}\n")
        f.write(f"USER MESSAGE: {msg}\n")
        f.write(f"{'='*60}\n")
        
        payload = json.dumps({
            "customerId": cust_id,
            "message": msg,
            "shop": "sharma-electronics"
        }).encode("utf-8")
        
        req = urllib.request.Request(
            "http://127.0.0.1:3001/api/chat",
            headers={"Content-Type": "application/json"},
            data=payload
        )
        
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.loads(resp.read().decode())
                reply = data.get("reply", "")
                reasoning = data.get("reasoning", "")
                f.write(f"\nAI REPLY:\n{reply}\n")
                f.write(f"\nREASONING: {reasoning}\n")
                print(f"[OK] {lang} done")
        except Exception as e:
            err_body = ""
            if hasattr(e, 'read'):
                try:
                    err_body = e.read().decode()
                except:
                    pass
            f.write(f"\nERROR: {e}\n{err_body}\n")
            print(f"[FAIL] {lang}: {e}")
        
        time.sleep(2)  # Rate limit buffer
    
    # Native script tests
    f.write("\n\n" + "=" * 70 + "\n")
    f.write("PART 2: NATIVE SCRIPT TESTS (via /api/chat)\n")
    f.write("=" * 70 + "\n")
    
    for lang, msg in TESTS_NATIVE:
        cust_id = f"lang-test-{lang.lower()}-{int(time.time())}"
        f.write(f"\n{'='*60}\n")
        f.write(f"LANGUAGE: {lang}\n")
        f.write(f"USER MESSAGE: {msg}\n")
        f.write(f"{'='*60}\n")
        
        payload = json.dumps({
            "customerId": cust_id,
            "message": msg,
            "shop": "sharma-electronics"
        }).encode("utf-8")
        
        req = urllib.request.Request(
            "http://127.0.0.1:3001/api/chat",
            headers={"Content-Type": "application/json"},
            data=payload
        )
        
        try:
            with urllib.request.urlopen(req, timeout=45) as resp:
                data = json.loads(resp.read().decode())
                reply = data.get("reply", "")
                reasoning = data.get("reasoning", "")
                f.write(f"\nAI REPLY:\n{reply}\n")
                f.write(f"\nREASONING: {reasoning}\n")
                print(f"[OK] {lang} done")
        except Exception as e:
            err_body = ""
            if hasattr(e, 'read'):
                try:
                    err_body = e.read().decode()
                except:
                    pass
            f.write(f"\nERROR: {e}\n{err_body}\n")
            print(f"[FAIL] {lang}: {e}")
        
        time.sleep(2)

print("\nDone! Check language_audit_results.txt")
