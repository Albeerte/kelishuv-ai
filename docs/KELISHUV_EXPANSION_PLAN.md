# Kelişuv kengaytmasi

2026-yil 21-noyabr. Foydalanuvçi SMS, Face ID, tölov va Zoom uçun hisoblari hozirça yöqligini bildirdi va integratsiyalarni ulaşga tayyor qilib yaratişni söradi.

## Amalga oşiriş tartibi

| Bosqiç | Natija | Asosiy fayllar |
| --- | --- | --- |
| Hisob va şaxs | Telefon orqali kiriş, SMS kod, şifrlangan pasport, AI maydonlari va provayder natijasi | `auth.ts`, `identity-api.ts`, `pages/services.tsx` |
| Ikki tarafli muloqot | Telefon yoki emailga boğlangan taklif, törtta navbatdagi taklif, suhbat yangilanişi | `mediation-api.ts`, `negotiation.ts`, `kelishuv-api.ts` |
| Huquqiy yordam | Har sahifada yordamçi, katalogdagi modda va manba havolalari | `assistant.ts`, `assistant-api.ts`, `components/assistant.tsx` |
| Xizmat va daromad | Hujjat tariflari, tölov buyurtmasi, mediator hisobi va 15 foiz hisob-kitobi | `service-api.ts`, `payme.ts`, `service-types.ts` |
| Dizayn va aloqa | Yirik Getsherik şriftlari, mobil köriniş, Zoom adapteri | `services.css`, `service-providers.ts` |
| Tekşiruv | Regressiya, API, brauzer, maxfiylik va işga tuşiriş tekşiruvlari | `scripts/test-kelishuv.cjs`, lokal QA fayllari |

Mavjud imzolaş, PDF/DOCX, versiya qulfi, hujjat köriş kvitansiyasi va uç iştirokçili tasdiqlaş qayta işlatiladi. Suhbat va takliflar faol sahifada 2 soniyalik sörovlar orqali yangilanadi.

## Tanlangan boşlanğiç narxlar

Talabnoma 19 000, mediatsiya arizasi 29 000 va da’vo loyihasi 49 000 söm. Bu qiymatlar foydalanuvçining narx belgilaş sörovi asosida tanlandi. `src/lib/service-catalog.ts` tariflar manbai hisoblanadi. Mediatorning xizmat hisobi özi kelişgan summadan tuziladi, ikki tarafga teng taqsimlanadi va 15 foiz platforma uluşi qayd etiladi. Bank orqali mediatorga ötkaziş provayder şartlari sozlangaç bajariladi.

## SMS ulanişi

`.env.local` faylida `ESKIZ_TOKEN` va `ESKIZ_SENDER` kiriting. Rasmiy kabinetda jönatuvçi va xizmat xabarlari şablonlarini tasdiqlating. Adapter Eskizning SMS yuboriş endpointidan foydalanadi. Kod 5 daqiqa amal qiladi, 5 uriniş bilan çeklangan va himoyalangan xeş sifatida saqlanadi. Telefon özgarsa tasdiq bekor qilinadi. [Eskiz SMS](https://www.eskiz.uz/sms), [Eskiz API qöllanmasi](https://documenter.getpostman.com/view/663428/RzfmES4z)

Taklif havolasi 7 kun amal qiladi. Telefon taklifini qabul qilişda aynan şu telefon SMS orqali tasdiqlangan bölişi kerak. Provayder ulanişi kutilayotgan muhitda havola yaratiş va köçiriş işlaydi, telefon tasdiqlaş bosqiçi kutilayotgan holatda qoladi. Emailga boğlangan takliflar mavjud hisoblar bilan işlaydi.

## Face ID adapteri şartnomasi

Mavjud adapter vakolatli şaxsni tekşiriş xizmati uçun normallaştirilgan bridge interfeysidir. MyID hisobini olgaç, uning SDK va autentifikatsiya jarayonini şu bridge bilan moslaştiriş kerak. [MyID hujjatlari](https://docs.myid.uz/)

Sozlamalar `IDENTITY_API_URL`, `IDENTITY_API_KEY`, `IDENTITY_WEBHOOK_SECRET`, `IDENTITY_REDIRECT_HOSTS`. HTTPS bridge uçun `POST /sessions` quyidagi JSON şaklini qabul qiladi.

```json
{
  "reference": "tekshiruvning-uuid-raqami",
  "returnUrl": "https://platforma.example/verify",
  "callbackUrl": "https://platforma.example/api/webhooks/identity"
}
```

Bridge `{ "id": "provider-session-id", "url": "https://ruxsat-berilgan-host.example/session" }` qaytaradi. `Authorization` sarlavhasida Bearer kaliti, `Idempotency-Key` sarlavhasida tekşiruv identifikatori uzatiladi. Qaytiş havolasining xosti `IDENTITY_REDIRECT_HOSTS` röyxati bilan tekşiriladi.

Provider bridge `/api/webhooks/identity` manziliga `reference`, `sessionId`, `status`, `liveness`, `documentVerified` va `fields` yuboradi. `fields` içida `firstName`, `lastName`, `middleName`, `birthDate`, `address`, `documentNumber` böladi. Sanalar `YYYY-MM-DD` şaklida yuboriladi. `status` qiymati `VERIFIED` yoki `FAILED` böladi.

Webhookda `x-identity-timestamp` Unix millisekundlari va `x-identity-signature` kiçik harfdagi hex imzo böladi. Imzo `HMAC-SHA256(secret, timestamp + "." + rawBody)` orqali olinadi. Server 5 daqiqalik vaqt oynasini, imzoni, sessiyani va hujjat maydonlarini tekşiradi. Natija bir marta yakunlanadi. Bridge muvaffaqiyatli 2xx javob olgunça qisqa keçikiş bilan callbackni takrorlaşi kerak.

Pasport rasmi mavjud şifrlangan fayl saqlaş orqali profilning xususiy tekşiruv bölimiga yoziladi. Tasvir modeli mavjud bölsa maydonlar taklif qilinadi, foydalanuvçi ularni tekşirib saqlaydi.

Face ID sessiyasi provayder tomonidan aniq rad etilsa qayta boşlaş oçiladi. Tarmoq natijasi noaniq bölsa imzolangan callback kutiladi. Olingan sessiya havolasini şu hisobdan qayta oçiş mumkin. 30 daqiqalik kutiş muddati tugagaç maydonlarni tuzatiş va yangi tekşiruvni boşlaş oçiladi. Almaştirilgan hujjatlarni öçirişdagi uzilişlar qayta işlaş uçun şifrlangan saqlaşda qayd etiladi.

## Payme ulanişi

`PAYME_MERCHANT_ID`, `PAYME_SECRET`, `PAYME_TEST_MODE` va `APP_PUBLIC_URL` qiymatlarini sozlang. Payme kabinetida `order_id` hisob maydonini va `/api/payments/payme` callback manzilini belgilang. Çeckout summalari tiyin birligida uzatiladi. Adapter ÇeckPerformTransaction, CreateTransaction, PerformTransaction, CancelTransaction, ÇeckTransaction va GetStatement usullarini qabul qiladi. [Payme Merçant API](https://developer.help.paycom.uz/metody-merchant-api/), [Çeckout havolasi](https://developer.help.paycom.uz/initsializatsiya-platezhey/otpravka-cheka-po-metodu-get/)

Tranzaksiya va buyurtmalar şifrlangan doimiy saqlaşda yuritiladi. Tasdiqlangan tölov hujjatga kirişni oçadi. Tölov bekor qilinsa huquq qayta tekşiriladi. Yuklangan xizmat böyiça qaytariş qöllab-quvvatlaş tartibida körib çiqiladi. Mediator uluşi buyurtmalar hisobida körsatiladi, bank orqali çiqariş uçun biznes hisob-kitob jarayoni kerak.

Tölovdan qaytiş manzili hujjat turini va nizoni qayta oçadi. Buyurtmaga yozilgan maydonlar tiklanadi. Hujjatning mazmunini foydalanuvçi tekşirgaç DOCX yaratiladi.

## Zoom ulanişi

Zoom Server-to-Server OAuth ilovasi uçun `ZOOM_ACCOUNT_ID`, `ZOOM_CLIENT_ID`, `ZOOM_CLIENT_SECRET`, `ZOOM_HOST_USER_ID` kiriting. Hisobda uçraşuv yaratiş uçun tegişli ruxsatlar bölsin. Sessiyani qabul qilgan mediator Zoom havolasini yaratadi, taraflar şu havoladan kiradi. [Zoom OAuth](https://developers.zoom.us/docs/internal-apps/s2s-oauth/), [Zoom Meetings API](https://developers.zoom.us/docs/api/meetings/)

OAuth yoki yaratiş sörovi aniq rad etilsa qayta uriniş oçiladi. Tarmoq sörovi noaniq yakunlansa sörov identifikatori saqlanadi. Bir daqiqadan söng qayta bosilganda adapter hostning rejalaştirilgan uçraşuvlarini şu identifikator böyiça tekşiradi va topilgan uçraşuvni tiklaydi. Buning uçun Zoom ilovasida uçraşuvlarni öqiş ruxsati ham kerak. Tekşiruv 500 ta rejalaştirilgan uçraşuv bilan çegaralangan, kattaroq röyxat böyiça administrator provayder holatini aniqlaştiradi. Kalitlar va host sozlamalarini töğrilagaç server qayta işga tuşiriladi.

## Huquqiy katalog

Yordamçi mavjud tanlangan moddalar katalogini işlatadi. Javobda modda mazmuni va Lex.uz havolasi server katalogidan olinadi. Model mavjud va rozilik berilgan bölsa mos moddalarni tanlaydi. Yangilaniş uçun loyihadagi Lex.uz ingestion jarayoni işlatiladi. Qöllaniş şartlari haqidagi savollar iş maydonidagi yönaltiriş oqimida aniqlaştiriladi. [Mediatsiya töğrisidagi qonun](https://lex.uz/docs/-3805227), [Davlat boji töğrisidagi qonun](https://lex.uz/docs/-4680944)

## Qabul qiliş tekşiruvlari

- Telefon yoki mavjud email bilan hisobga kiriş işlaydi.
- Hujjat, OTP va Face ID natijalari foydalanuvçining öz hisobiga boğlangan.
- Provayder sozlanmaganida aniq kutilayotgan holat körsatiladi.
- Har taklifda ikki tarafning javobi talab qilinadi.
- Tölov, imzo va çat qayta urinişlari joriy holatga mos tekşiriladi.
- Hujjat tariflari va mediatorning jami, platforma, sof uluşlari tuşunarli körinadi.
- Mobil sahifalarda matn, tugmalar va imzo oynalari işlaydi.
- Asosiy lokal va ommaviy namoyiş muhiti öz hisoblarida saqlanadi.
