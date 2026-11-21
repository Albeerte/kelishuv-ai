# KELIŞUV interfeysini yangilaş rejasi

## Yönaliş

2026-11-20 kuni mavjud Next.js, React, autentifikatsiya, şifrlangan ombor, API, mediator tayinlaş, imzolaş va ijro oqimlari körib çiqildi. Interfeys şu APIlar bilan işlaydi.

getsherik.uz sahifasiga tarmoq kirişi 403 javobi bilan çeklandi. Dizayn foydalanuvçi biriktirgan batafsil talablar asosida işlab çiqildi.

## Dizayn tizimi

Örmon-yaşil `#174C3C`, sage `#EAF0E8`, iliq oq `#F8F8F2`, oq sirt `#FFFFFF`, töq matn `#243A32`, yordamçi matn `#5D6A63`, amber `#D2AA59`. Inter mahalliy şriftlari işlatiladi. Matn 16px atrofida, qator oraliği 1.6. Bitta asosiy amal, qisqa tuşuntiriş, qolgan ma’lumot oçiladigan bölimlarda beriladi.

Taqdimotda çapda aniq sarlavha, öngda insoniy suhbat illustratsiyasi. Xizmatlar uçta ixçam izoh, jarayon törtta qadam, narxlar ikkita sodda bölim va FAQ orqali körsatiladi. Şaxsiy kabinetda katta boşlaş amali va işlar röyxati mavjud. Menyuda boş sahifa, işlar, xabarlar, hujjatlar, tölovlar va profil bor.

## Amalga oşiriş

1. Dizayn tokenlari va umumiy navigatsiya.
2. Taqdimot, narx, savol-javob va ma’lumot sahifalari.
3. Rol tanlaş, qisqa röyxatdan ötiş, şartlarga rozilik va taniştiriş.
4. Şaxsiy kabinet va sodda işlar röyxati.
5. Beş qadamli murojaat, hisobga boğlangan vaqtinçalik qoralama, yakuniy körik.
6. Iş tafsilotida jarayon, keyingi amal va oçiladigan huquqiy ma’lumot.
7. Mediator va administratorning vazifaga yönaltirilgan bölimlari.
8. Mobil ekran, klaviatura, rang kontrasti, brauzer/API va build tekşiruvlari.

## Illustratsiya

Built-in imagegen orqali original asset yaratildi. Manzil `public/images/mediation-conversation.png`.

Prompt — Two Central Asian adults, a woman and a man in contemporary modest everyday clothes, sit comfortably facing eaç other across a small rounded table, having a calm thoughtful constructive conversation. Both are listening and making relaxed open-hand gestures, emotionally safe and equal. A single paper and small cup, a simple leafy plant. Handmade gouaçe and fine pencil editorial illustration, softly grainy texture, expressive human faces. Forest green, sage, warm cream and muted amber. Landscape 4:3, generous breathing room. No text, logos, scales of justice, robots, badges or UI elements.

## Çegaralar

Mavjud email/parol autentifikatsiyasi qöllanadi. OTP xizmati sozlanmagan. Namuna narxlari va profillar tegişli belgi bilan beriladi. Aloqa uçun mavjud murojaat formasi işlatiladi, rasmiy ijtimoiy kanal manzillari foydalanuvçi taqdim etgaç ulanadi. Qoralama uşbu qurilmadagi sessiya saqlaşida hisob böyiça ajratiladi.

## Yakuniy holat

2026-11-21 kuni yangi taqdimot, ommaviy ma’lumot sahifalari, ikki qadamli röyxatdan ötiş, taniştiriş, olti bandli mijoz menyusi, işlar röyxati, tölovlar, beş qadamli murojaat va iş jarayoni amalga oşirildi. Mediator hamda administrator bölimlari yangi rang, öqiladigan jadval, qidiruv va vazifaga tegişli ma’lumotlar bilan yangilandi. Özbek lotin, kirill va rus luğatlari töldirildi.

Murojaatning sörov identifikatori serverda hisob va mazmun xeşiga boğlanadi. Uzilgan javobdan keyingi takroriy sörov saqlangan işni qaytaradi. Yuborilgan ma’lumot tiklangunça körik bosqiçida saqlanadi. Avvalgi qoralamada özgargan mazmun bölsa, mavjud iş topiladi va yangi murojaat boşlaş amali oçiladi. Muvaffaqiyatsiz taklif hamda yuklanmagan fayl nomlari brauzer sessiyasida tiklanadi. Faylning özi qayta tanlanadi.

## Tekşiruv natijalari

- `npm run lint`, `npm run typecheck`, `npm test` va production build ötdi. Saqlangan 12 regressiya testi muvaffaqiyatli bajarildi.
- 97 API tekşiruvi maxfiylik, ruxsatlar, hujjat nusxalari, uç taraf imzosi, PDF/DOCX va ijro oqimini qamradi.
- 13 brauzer tekşiruvi uç rol uçun röyxatdan ötiş, onboarding, ariza, hujjat, taklif, admin filtrlari va til almaştirişni qamradi.
- 10 tiklaş tekşiruvi uzilgan javob, parallel yuboriş, avvalgi qoralama, saqlaş ruxsati, hisob almaştiriş, taklif hamda fayl almaştirişni qamradi.
- 24 axe-core tekşiruvida WCAG 2 A/AA, 2.1 AA va 2.2 AA teglariga tegişli xato qaytmadi. Klaviaturada asosiy mazmunga ötiş va FAQ oçiş tekşirildi.
- Yangi hujjat uçun keyingi amal, mobil menyu va professional bölimlarning olti ekran ölçami böyiça törtta qöşimça tekşiruv ötdi.
- Brauzerda siçqonça, dasturiy touç va pen hodisalari bilan uç imzo hamda PDFning barça sahifalarini öqiş qayta tekşirildi.
- `npm audit` ma’lum zaiflik qaytarmadi. Mustaqil kod körigida aniqlangan tiklaş kamçiliklari tuzatildi va yakuniy körik ötdi.

Sinovlar yaratgan 21 hisob, 14 iş va ularga tegişli hujjatlar aniq identifikatorlar böyiça çiqarildi. Şifrlangan zaxira olindi. Mavjud beş iş, tört hisob va bitta sessiya saqlandi. Xizmat `127.0.0.1:2345` manzilida lokal işlaydi.

## Asosiy amallarga urğu, 2026-11-21

Landing sahifasining asosiy tugmasi röyxatdan ötişni aniq bildiradi. Uning yonida ixtiyoriy iştirok, hujjatlar şifrlanişi va mediator bilan suhbat haqidagi qisqa ma’lumotlar beriladi.

Foydalanuvçi kabinetining birinçi ekranida 64px balandlikdagi «Yangi muammo boşlaş» tugmasi turadi. Keyin işlar röyxati oçiladi. Asosiy menyuda olti bölim bor. Işlar statistikasi yuklanişida xato bölsa ham, murojaat boşlaş amali oçiq turadi.

Admin menyusi yetti asosiy bölimdan iborat. Umumiy körinişda oltita amaliy körsatkiç va sönggi işlar körsatiladi. Hisobotlar yönalişlar va haqiqiy iş sonlari röyxatida beriladi.

360, 390, 768, 1024 va 1440px ekranlar, sakkizta brauzer oqimi, töqqizta avtomatik WCAG tekşiruvi va 12 regressiya testi ötdi. Production build, ESLint, TypeScript va mustaqil kod körigi muvaffaqiyatli yakunlandi.
