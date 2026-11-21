# KELISHUV interfeysini yangilash rejasi

## Yo‘nalish

2026-11-20 kuni mavjud Next.js, React, autentifikatsiya, shifrlangan ombor, API, mediator tayinlash, imzolash va ijro oqimlari ko‘rib chiqildi. Interfeys shu APIlar bilan ishlaydi.

getsherik.uz sahifasiga tarmoq kirishi 403 javobi bilan cheklandi. Dizayn foydalanuvchi biriktirgan batafsil talablar asosida ishlab chiqildi.

## Dizayn tizimi

O‘rmon-yashil `#174C3C`, sage `#EAF0E8`, iliq oq `#F8F8F2`, oq sirt `#FFFFFF`, to‘q matn `#243A32`, yordamchi matn `#5D6A63`, amber `#D2AA59`. Inter mahalliy shriftlari ishlatiladi. Matn 16px atrofida, qator oralig‘i 1.6. Bitta asosiy amal, qisqa tushuntirish, qolgan ma’lumot ochiladigan bo‘limlarda beriladi.

Taqdimotda chapda aniq sarlavha, o‘ngda insoniy suhbat illustratsiyasi. Xizmatlar uchta ixcham izoh, jarayon to‘rtta qadam, narxlar ikkita sodda bo‘lim va FAQ orqali ko‘rsatiladi. Shaxsiy kabinetda katta boshlash amali va ishlar ro‘yxati mavjud. Menyuda bosh sahifa, ishlar, xabarlar, hujjatlar, to‘lovlar va profil bor.

## Amalga oshirish

1. Dizayn tokenlari va umumiy navigatsiya.
2. Taqdimot, narx, savol-javob va ma’lumot sahifalari.
3. Rol tanlash, qisqa ro‘yxatdan o‘tish, shartlarga rozilik va tanishtirish.
4. Shaxsiy kabinet va sodda ishlar ro‘yxati.
5. Besh qadamli murojaat, hisobga bog‘langan vaqtinchalik qoralama, yakuniy ko‘rik.
6. Ish tafsilotida jarayon, keyingi amal va ochiladigan huquqiy ma’lumot.
7. Mediator va administratorning vazifaga yo‘naltirilgan bo‘limlari.
8. Mobil ekran, klaviatura, rang kontrasti, brauzer/API va build tekshiruvlari.

## Illustratsiya

Built-in imagegen orqali original asset yaratildi. Manzil `public/images/mediation-conversation.png`.

Prompt — Two Central Asian adults, a woman and a man in contemporary modest everyday clothes, sit comfortably facing each other across a small rounded table, having a calm thoughtful constructive conversation. Both are listening and making relaxed open-hand gestures, emotionally safe and equal. A single paper and small cup, a simple leafy plant. Handmade gouache and fine pencil editorial illustration, softly grainy texture, expressive human faces. Forest green, sage, warm cream and muted amber. Landscape 4:3, generous breathing room. No text, logos, scales of justice, robots, badges or UI elements.

## Chegaralar

Mavjud email/parol autentifikatsiyasi qo‘llanadi. OTP xizmati sozlanmagan. Namuna narxlari va profillar tegishli belgi bilan beriladi. Aloqa uchun mavjud murojaat formasi ishlatiladi, rasmiy ijtimoiy kanal manzillari foydalanuvchi taqdim etgach ulanadi. Qoralama ushbu qurilmadagi sessiya saqlashida hisob bo‘yicha ajratiladi.

## Yakuniy holat

2026-11-21 kuni yangi taqdimot, ommaviy ma’lumot sahifalari, ikki qadamli ro‘yxatdan o‘tish, tanishtirish, olti bandli mijoz menyusi, ishlar ro‘yxati, to‘lovlar, besh qadamli murojaat va ish jarayoni amalga oshirildi. Mediator hamda administrator bo‘limlari yangi rang, o‘qiladigan jadval, qidiruv va vazifaga tegishli ma’lumotlar bilan yangilandi. O‘zbek lotin, kirill va rus lug‘atlari to‘ldirildi.

Murojaatning so‘rov identifikatori serverda hisob va mazmun xeshiga bog‘lanadi. Uzilgan javobdan keyingi takroriy so‘rov saqlangan ishni qaytaradi. Yuborilgan ma’lumot tiklanguncha ko‘rik bosqichida saqlanadi. Avvalgi qoralamada o‘zgargan mazmun bo‘lsa, mavjud ish topiladi va yangi murojaat boshlash amali ochiladi. Muvaffaqiyatsiz taklif hamda yuklanmagan fayl nomlari brauzer sessiyasida tiklanadi. Faylning o‘zi qayta tanlanadi.

## Tekshiruv natijalari

- `npm run lint`, `npm run typecheck`, `npm test` va production build o‘tdi. Saqlangan 12 regressiya testi muvaffaqiyatli bajarildi.
- 97 API tekshiruvi maxfiylik, ruxsatlar, hujjat nusxalari, uch taraf imzosi, PDF/DOCX va ijro oqimini qamradi.
- 13 brauzer tekshiruvi uch rol uchun ro‘yxatdan o‘tish, onboarding, ariza, hujjat, taklif, admin filtrlari va til almashtirishni qamradi.
- 10 tiklash tekshiruvi uzilgan javob, parallel yuborish, avvalgi qoralama, saqlash ruxsati, hisob almashtirish, taklif hamda fayl almashtirishni qamradi.
- 24 axe-core tekshiruvida WCAG 2 A/AA, 2.1 AA va 2.2 AA teglariga tegishli xato qaytmadi. Klaviaturada asosiy mazmunga o‘tish va FAQ ochish tekshirildi.
- Yangi hujjat uchun keyingi amal, mobil menyu va professional bo‘limlarning olti ekran o‘lchami bo‘yicha to‘rtta qo‘shimcha tekshiruv o‘tdi.
- Brauzerda sichqoncha, dasturiy touch va pen hodisalari bilan uch imzo hamda PDFning barcha sahifalarini o‘qish qayta tekshirildi.
- `npm audit` ma’lum zaiflik qaytarmadi. Mustaqil kod ko‘rigida aniqlangan tiklash kamchiliklari tuzatildi va yakuniy ko‘rik o‘tdi.

Sinovlar yaratgan 21 hisob, 14 ish va ularga tegishli hujjatlar aniq identifikatorlar bo‘yicha chiqarildi. Shifrlangan zaxira olindi. Mavjud besh ish, to‘rt hisob va bitta sessiya saqlandi. Xizmat `127.0.0.1:2345` manzilida lokal ishlaydi.

## Asosiy amallarga urg‘u, 2026-11-21

Landing sahifasining asosiy tugmasi ro‘yxatdan o‘tishni aniq bildiradi. Uning yonida ixtiyoriy ishtirok, hujjatlar shifrlanishi va mediator bilan suhbat haqidagi qisqa ma’lumotlar beriladi.

Foydalanuvchi kabinetining birinchi ekranida 64px balandlikdagi «Yangi muammo boshlash» tugmasi turadi. Keyin ishlar ro‘yxati ochiladi. Asosiy menyuda olti bo‘lim bor. Ishlar statistikasi yuklanishida xato bo‘lsa ham, murojaat boshlash amali ochiq turadi.

Admin menyusi yetti asosiy bo‘limdan iborat. Umumiy ko‘rinishda oltita amaliy ko‘rsatkich va so‘nggi ishlar ko‘rsatiladi. Hisobotlar yo‘nalishlar va haqiqiy ish sonlari ro‘yxatida beriladi.

360, 390, 768, 1024 va 1440px ekranlar, sakkizta brauzer oqimi, to‘qqizta avtomatik WCAG tekshiruvi va 12 regressiya testi o‘tdi. Production build, ESLint, TypeScript va mustaqil kod ko‘rigi muvaffaqiyatli yakunlandi.
