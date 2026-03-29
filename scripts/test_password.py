import bcrypt

hash_from_db = "$2b$12$K2V4HfBt0rTJy.ZblylnyeXL0.GYmEsULC9q/hfFpS7BUQXZi3Efe"
password = "Admin@2024!"

if bcrypt.checkpw(password.encode('utf-8'), hash_from_db.encode('utf-8')):
    print("✓ Password matches!")
else:
    print("✗ Password does NOT match")
