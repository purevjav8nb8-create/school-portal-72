def get_teachers_list():
    units = ["БАЗАН", "БУЗАН", "НУЗАН"]
    teachers = []
    total_count = 45 
    
    for i in range(1, total_count + 1):
        unit = units[i % 3]
        if unit == "БАЗАН":
            subject = "Бага ангийн багш"
        elif unit == "БУЗАН":
            subject = "Математик" if i % 2 == 0 else "Физик"
        else:
            subject = "Түүх, нийгэм" if i % 2 == 0 else "Монгол хэл"

        att = "Ирсэн"
        if i % 5 == 0:
            att = "Хоцорсон"
        elif i % 8 == 0:
            att = "Чөлөөтэй"
        elif i % 11 == 0:
            att = "Өвчтэй"
        elif i % 15 == 0:
            att = "Тасалсан"

        teachers.append({
            "id": i,
            "last_name": f"Овог {i}",
            "first_name": f"Багш {i}",
            "email": f"teacher{i}@moes.edu.mn",
            "unit": unit,
            "subject": subject,
            "attendance": att,
            "monthly_attendance_rate": 85 + (i % 15),
            "training_status": "Хамрагдсан" if i % 2 == 0 else "Хамрагдаагүй",
            "rating": 80 + (i % 20),
            "monthly_login_count": (i * 4) % 25,
            "lms_username": f"ES351057{i:04d}"
        })
    return teachers