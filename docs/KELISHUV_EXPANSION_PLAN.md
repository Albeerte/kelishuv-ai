# Kelishuv kengaytmasi

2026-yil 21-noyabr. Foydalanuvchi SMS, Face ID, to‘lov va Zoom uchun hisoblari hozircha yo‘qligini bildirdi va integratsiyalarni ulashga tayyor qilib yaratishni so‘radi.

## Amalga oshirish tartibi

| Bosqich | Natija | Asosiy fayllar |
| --- | --- | --- |
| Hisob va shaxs | Telefon orqali kirish, SMS kod, shifrlangan pasport, AI maydonlari va provayder natijasi | `auth.ts`, `identity-api.ts`, `pages/services.tsx` |
| Ikki tarafli muloqot | Telefon yoki emailga bog‘langan taklif, to‘rtta navbatdagi taklif, suhbat yangilanishi | `mediation-api.ts`, `negotiation.ts`, `kelishuv-api.ts` |
| Huquqiy yordam | Har sahifada yordamchi, katalogdagi modda va manba havolalari | `assistant.ts`, `assistant-api.ts`, `components/assistant.tsx` |
| Xizmat va daromad | Hujjat tariflari, to‘lov buyurtmasi, mediator hisobi va 15 foiz hisob-kitobi | `service-api.ts`, `payme.ts`, `service-types.ts` |
| Dizayn va aloqa | Yirik Getsherik shriftlari, mobil ko‘rinish, Zoom adapteri | `services.css`, `service-providers.ts` |
| Tekshiruv | Regressiya, API, brauzer, maxfiylik va ishga tushirish tekshiruvlari | `scripts/test-kelishuv.cjs`, lokal QA fayllari |

Mavjud imzolash, PDF/DOCX, versiya qulfi, hujjat ko‘rish kvitansiyasi va uch ishtirokchili tasdiqlash qayta ishlatiladi. Suhbat va takliflar faol sahifada 2 soniyalik so‘rovlar orqali yangilanadi.

## Tanlangan boshlang‘ich narxlar

Talabnoma 19 000, mediatsiya arizasi 29 000 va da’vo loyihasi 49 000 so‘m. Bu qiymatlar foydalanuvchining narx belgilash so‘rovi asosida tanlandi. `src/lib/service-catalog.ts` tariflar manbai hisoblanadi. Mediatorning xizmat hisobi o‘zi kelishgan summadan tuziladi, ikki tarafga teng taqsimlanadi va 15 foiz platforma ulushi qayd etiladi. Bank orqali mediatorga o‘tkazish provayder shartlari sozlangach bajariladi.

## SMS ulanishi

`.env.local` faylida `ESKIZ_TOKEN` va `ESKIZ_SENDER` kiriting. Rasmiy kabinetda jo‘natuvchi va xizmat xabarlari shablonlarini tasdiqlating. Adapter Eskizning SMS yuborish endpointidan foydalanadi. Kod 5 daqiqa amal qiladi, 5 urinish bilan cheklangan va himoyalangan xesh sifatida saqlanadi. Telefon o‘zgarsa tasdiq bekor qilinadi. [Eskiz SMS](https://www.eskiz.uz/sms), [Eskiz API qo‘llanmasi](https://documenter.getpostman.com/view/663428/RzfmES4z)

Taklif havolasi 7 kun amal qiladi. Telefon taklifini qabul qilishda aynan shu telefon SMS orqali tasdiqlangan bo‘lishi kerak. Provayder ulanishi kutilayotgan muhitda havola yaratish va ko‘chirish ishlaydi, telefon tasdiqlash bosqichi kutilayotgan holatda qoladi. Emailga bog‘langan takliflar mavjud hisoblar bilan ishlaydi.

## Face ID adapteri shartnomasi

Mavjud adapter vakolatli shaxsni tekshirish xizmati uchun normallashtirilgan bridge interfeysidir. MyID hisobini olgach, uning SDK va autentifikatsiya jarayonini shu bridge bilan moslashtirish kerak. [MyID hujjatlari](https://docs.myid.uz/)

Sozlamalar `IDENTITY_API_URL`, `IDENTITY_API_KEY`, `IDENTITY_WEBHOOK_SECRET`, `IDENTITY_REDIRECT_HOSTS`. HTTPS bridge uchun `POST /sessions` quyidagi JSON shaklini qabul qiladi.

```json
{
  "reference": "tekshiruvning-uuid-raqami",
  "returnUrl": "https://platforma.example/verify",
  "callbackUrl": "https://platforma.example/api/webhooks/identity"
}
```

Bridge `{ "id": "provider-session-id", "url": "https://ruxsat-berilgan-host.example/session" }` qaytaradi. `Authorization` sarlavhasida Bearer kaliti, `Idempotency-Key` sarlavhasida tekshiruv identifikatori uzatiladi. Qaytish havolasining xosti `IDENTITY_REDIRECT_HOSTS` ro‘yxati bilan tekshiriladi.

Provider bridge `/api/webhooks/identity` manziliga `reference`, `sessionId`, `status`, `liveness`, `documentVerified` va `fields` yuboradi. `fields` ichida `firstName`, `lastName`, `middleName`, `birthDate`, `address`, `documentNumber` bo‘ladi. Sanalar `YYYY-MM-DD` shaklida yuboriladi. `status` qiymati `VERIFIED` yoki `FAILED` bo‘ladi.

Webhookda `x-identity-timestamp` Unix millisekundlari va `x-identity-signature` kichik harfdagi hex imzo bo‘ladi. Imzo `HMAC-SHA256(secret, timestamp + "." + rawBody)` orqali olinadi. Server 5 daqiqalik vaqt oynasini, imzoni, sessiyani va hujjat maydonlarini tekshiradi. Natija bir marta yakunlanadi. Bridge muvaffaqiyatli 2xx javob olguncha qisqa kechikish bilan callbackni takrorlashi kerak.

Pasport rasmi mavjud shifrlangan fayl saqlash orqali profilning xususiy tekshiruv bo‘limiga yoziladi. Tasvir modeli mavjud bo‘lsa maydonlar taklif qilinadi, foydalanuvchi ularni tekshirib saqlaydi.

Face ID sessiyasi provayder tomonidan aniq rad etilsa qayta boshlash ochiladi. Tarmoq natijasi noaniq bo‘lsa imzolangan callback kutiladi. Olingan sessiya havolasini shu hisobdan qayta ochish mumkin. 30 daqiqalik kutish muddati tugagach maydonlarni tuzatish va yangi tekshiruvni boshlash ochiladi. Almashtirilgan hujjatlarni o‘chirishdagi uzilishlar qayta ishlash uchun shifrlangan saqlashda qayd etiladi.

## Payme ulanishi

`PAYME_MERCHANT_ID`, `PAYME_SECRET`, `PAYME_TEST_MODE` va `APP_PUBLIC_URL` qiymatlarini sozlang. Payme kabinetida `order_id` hisob maydonini va `/api/payments/payme` callback manzilini belgilang. Checkout summalari tiyin birligida uzatiladi. Adapter CheckPerformTransaction, CreateTransaction, PerformTransaction, CancelTransaction, CheckTransaction va GetStatement usullarini qabul qiladi. [Payme Merchant API](https://developer.help.paycom.uz/metody-merchant-api/), [Checkout havolasi](https://developer.help.paycom.uz/initsializatsiya-platezhey/otpravka-cheka-po-metodu-get/)

Tranzaksiya va buyurtmalar shifrlangan doimiy saqlashda yuritiladi. Tasdiqlangan to‘lov hujjatga kirishni ochadi. To‘lov bekor qilinsa huquq qayta tekshiriladi. Yuklangan xizmat bo‘yicha qaytarish qo‘llab-quvvatlash tartibida ko‘rib chiqiladi. Mediator ulushi buyurtmalar hisobida ko‘rsatiladi, bank orqali chiqarish uchun biznes hisob-kitob jarayoni kerak.

To‘lovdan qaytish manzili hujjat turini va nizoni qayta ochadi. Buyurtmaga yozilgan maydonlar tiklanadi. Hujjatning mazmunini foydalanuvchi tekshirgach DOCX yaratiladi.

## Zoom ulanishi

Zoom Server-to-Server OAuth ilovasi uchun `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_HOST_USER_ID` kiriting. Hisobda uchrashuv yaratish uchun tegishli ruxsatlar bo‘lsin. Sessiyani qabul qilgan mediator Zoom havolasini yaratadi, taraflar shu havoladan kiradi. [Zoom OAuth](https://developers.zoom.us/docs/internal-apps/s2s-oauth/), [Zoom Meetings API](https://developers.zoom.us/docs/api/meetings/)

OAuth yoki yaratish so‘rovi aniq rad etilsa qayta urinish ochiladi. Tarmoq so‘rovi noaniq yakunlansa so‘rov identifikatori saqlanadi. Bir daqiqadan so‘ng qayta bosilganda adapter hostning rejalashtirilgan uchrashuvlarini shu identifikator bo‘yicha tekshiradi va topilgan uchrashuvni tiklaydi. Buning uchun Zoom ilovasida uchrashuvlarni o‘qish ruxsati ham kerak. Tekshiruv 500 ta rejalashtirilgan uchrashuv bilan chegaralangan, kattaroq ro‘yxat bo‘yicha administrator provayder holatini aniqlashtiradi. Kalitlar va host sozlamalarini to‘g‘rilagach server qayta ishga tushiriladi.

## Huquqiy katalog

Yordamchi mavjud tanlangan moddalar katalogini ishlatadi. Javobda modda mazmuni va Lex.uz havolasi server katalogidan olinadi. Model mavjud va rozilik berilgan bo‘lsa mos moddalarni tanlaydi. Yangilanish uchun loyihadagi Lex.uz ingestion jarayoni ishlatiladi. Qo‘llanish shartlari haqidagi savollar ish maydonidagi yo‘naltirish oqimida aniqlashtiriladi. [Mediatsiya to‘g‘risidagi qonun](https://lex.uz/docs/-3805227), [Davlat boji to‘g‘risidagi qonun](https://lex.uz/docs/-4680944)

## Qabul qilish tekshiruvlari

- Telefon yoki mavjud email bilan hisobga kirish ishlaydi.
- Hujjat, OTP va Face ID natijalari foydalanuvchining o‘z hisobiga bog‘langan.
- Provayder sozlanmaganida aniq kutilayotgan holat ko‘rsatiladi.
- Har taklifda ikki tarafning javobi talab qilinadi.
- To‘lov, imzo va chat qayta urinishlari joriy holatga mos tekshiriladi.
- Hujjat tariflari va mediatorning jami, platforma, sof ulushlari tushunarli ko‘rinadi.
- Mobil sahifalarda matn, tugmalar va imzo oynalari ishlaydi.
- Asosiy lokal va ommaviy namoyish muhiti o‘z hisoblarida saqlanadi.
