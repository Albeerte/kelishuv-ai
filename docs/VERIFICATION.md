# KELIŞUV AI tekşiruv natijalari

2026-11-20 kuni Windows, Node.js 24.19, Çrome va `127.0.0.1:2345` muhitida tekşirildi.

## Muhandislik tekşiruvi

| Tekşiruv | Natija |
| --- | --- |
| TypeScript | `npm run typecheck` ötdi |
| ESLint | TypeScript recommended qoidalari, nol xato |
| Saqlangan regressiyalar | `npm test`, 12 test ötdi |
| Production build | Next.js 15.5.29 build ötdi |
| Dependency audit | `npm audit`, nol ma’lum zaiflik |
| Mustaqil statik körik | Yangi backend modullari va PDF jarayoni böyiça yakuniy köriklar ötdi |

## API oqimlari

Asosiy töplamda 97 tekşiruv ötdi. Röyxatdan ötiş, login, emailga boğlangan taklif, mustaqil bayon, şaxsiy dalil, administrator va begona hisob ruxsati, törtta taklif, mediator tanlovi, uç iştirokçi imzosi, nusxa almaştiriş, PDF/DOCX va ijro hisoboti qamraldi.

Qöşimça töplamda 41 tekşiruv ötdi. Nizo yakunlangandan keyingi AI roziligini qaytariş, parallel körik qaydlari, eski ijro tarixi, DOCX va PDF matni, mahalliy skan OCR hamda eslatma idempotentligi tekşirildi.

Ijro böyiça 25 tekşiruv ötdi. Eski nusxaga tegişli keçikkan hisobot, arxivdagi sörov identifikatori, özgargan dalil biriktirmasi, nusxasiz sörov, töğri takroriy sörov va pulga oid bölmagan majburiyatning dastlabki bajariliş vaqti tekşirildi.

## Brauzerdagi amallar

- Mediator interfeys orqali PDF/DOCX kelişuv yaratdi.
- Har bir iştirokçi PDFning barça sahifalarini oçdi va ixtiyoriy tasdiqladi.
- Birinçi taraf siçqonça bilan imzoladi, undo va clear işlatildi.
- Ikkinçi taraf 390px ekranda CDP touç hodisalari bilan imzoladi. Sahifa imzolaş vaqtida siljimadi.
- Mediator bosim ma’lumoti berilgan pen Pointer Events bilan imzoladi.
- Uç imzo va ularning tartibi yakuniy faylda tekşirildi.
- 1440, 1280, 1024, 768, 390 va 360px ekranlarda taşqi gorizontal toşiş kuzatilmadi.
- 360px PDF preview 200% kattalaştirildi, uning içida gorizontal pan işladi.
- Mediator narx va şahar filtrlari, e’lon qilingan qabul jadvali, sessiya bron qiliş va ICS yuklaş işladi.
- Maxfiy xabar tegişli mediatorga körindi. Qarşi taraf uçun kiriş sinovi ötdi.
- Tölov hisoboti foydalanuvçi formasidan yuborildi va qabul qiluvçi taraf orqali tasdiqlandi.
- Ma’lumot sörovi Sozlamalardan yuborildi va administrator javobi saqlandi.
- Özbek lotin, kirill va rus tili almaştirildi. Bank hisobi forma orqali yaratildi va şu hisobga kirildi.

Jismoniy barmoq va stilus qurilmasi bilan apparat sinovi hali bajarilişi kerak. Avtomatlaştirilgan sensor va pen hodisalari dasturiy oqimni qamraydi.

## Hujjat renderi va AI

Yakuniy ikki sahifali PDF PNGga render qilinib közdan keçirildi. Uç imzo, rekvizit, vaqt, nusxa raqami va xeş joylaşuvi tekşirildi. Imzo ustma-ust tuşişi va sahifa çegarasidan çiqişi rad etildi. DOCX xom matni, fayl xeşi va imzo tasvirlari tekşirildi.

`qwen3-vl:8b-instruct` bilan haqiqiy mahalliy tahlil va dalil ekstraksiyasi bajarildi. Oçiq tahlilda şaxsiy markerlar kuzatilmadi. Maxfiy tahlil boşqa tarafga oçilmadi. Sintetik rasm va skan PDFdan 1,200,000 sömlik summa ajratildi. Natija `verified=false` holatida saqlandi. Bu sinov keng özbek huquqiy bençmarki hisoblanmaydi.

## Çegaralangan hujjat işlovi

PDF matni oqimdan 18,000 belgigaça olinadi. Jarayonning JavaScript heap çegarasi 192 MiB va vaqt çegarasi 20 soniya. Native rastrning eng uzun tomoni 1400 piksel. DOCX uçun haqiqiy ZIP oqimi va 30 MiB kengaygan hajm tekşiriladi. PNG/JPEG ölçami native dekodlaşdan avval tekşiriladi.

Bir sahifali, ikki MiB matni kuçli siqilgan PDF, juda katta sahifa ölçami, ZIP içidagi soxta katalog sarlavhasi, notöğri deklarativ ZIP hajmi va katta PNG sarlavhasi regressiya töplamiga kiritilgan.

## Accessibility

Agreement preview, mediatorlar, muloqot, ijro, röyxatdan ötiş va taqdimot sahifalari axe-core WCAG 2 A/AA qoidalari bilan tekşirildi. Yakuniy olti sahifada uşbu qoidalar böyiça nol xato qaytdi. Matn kontrasti töğrilandi va siljitiladigan PDF maydoni klaviatura fokusiga oçildi. Uşbu natija avtomatlaştirilgan tekşiruv doirasiga tegişli.

## Sinov ma’lumotlarini tozalaş

Sinovlar yaratgan hisob, nizo, hujjat, tölov va bildirişnoma yozuvlari ularning aniq identifikatorlari asosida çiqarildi. Tozalaşdan oldin şifrlangan zaxira olindi. Foydalanuvçiga tegişli beşta nizo, törtta mavjud hisob va oldingi sessiya saqlandi. Yakuniy audit zanjiri hamda mahalliy manzil qayta tekşirildi.

## Taşqi xizmatlar

ERI, OneID, real tölov yiğiş va payout sozlanmagan. Jitsi taşqi uçraşuv havolasini beradi. SMTP, PostgreSQL, Redis, S3, Qdrant va Docker yöllari tegişli xizmat muhiti bilan alohida tekşiriladi. Qonuniy rasmiylaştiriş va şaxs rekvizitlarini mediator tekşiradi. Mahalliy qölda imzo vizual yozuv va audit bilan saqlanadi.

## Interfeys yangilanişi, 2026-11-21

Yangi yaşil va iliq oq dizayn amaldagi APIlar orqali tekşirildi. 97 API tekşiruvi, 12 saqlangan regressiya, 13 brauzer oqimi va 10 tiklaş tekşiruvi ötdi. Keyingi amal, mobil menyu hamda administrator va mediator bölimlarining 360–1440px körinişlari qöşimça tekşirildi.

24 sahifa va forma holatida axe-core WCAG 2 A/AA, 2.1 AA va 2.2 AA teglari böyiça nol xato qaytdi. Klaviatura orqali asosiy mazmunga ötiş, FAQ va içida siljitiladigan jadvalning fokus olişi tekşirildi. Brauzer tekşiruvlarida `pageerror` qaytmadi. Bu natijalar avtomatlaştirilgan tekşiruv doirasiga tegişli.

Uzilgan röyxatdan ötiş javobidan keyin kiriş, qayta yuborişda bitta ariza saqlanişi, bir hisob qoralamasining boşqa hisobdan ajratilişi, muvaffaqiyatsiz taklifni tiklaş va yuklanmagan hujjat nomlarini saqlaş sinovdan ötdi. Rad etilgan sörovdan keyin önta faylni almaştiriş qoralama hajmi va tiklaşini buzmasligi tekşirildi.

Production build, TypeScript, ESLint va dependency audit ötdi. Next.js build mavjud ESLint konfiguratsiyasida Next.js plagini aniqlanmagani haqida ogohlantiriş berdi. Alohida ESLint tekşiruvi nol xato bilan yakunlandi. Yakuniy mustaqil kod körigi ötdi.

Sinovga tegişli 21 hisob, 14 iş va 48 şifrlangan fayl çiqarildi. Mavjud beş iş, tört hisob, bitta sessiya saqlandi. Tozalaşdan oldin şifrlangan zaxira olindi. Dizayn, asset prompti va foydalanuvçi jarayonlari [redesign rejasida](REDESIGN_PLAN.md) qayd etilgan.

## Getsherik asosidagi dizayn va ekstraksiya

Getsherik’ning ommaviy HTML manbasi IntelliScrape hosted xizmati orqali olinib, lokal Çromium’da Site Deep Clone modullari bilan ölçandi. Törtta ekran ölçami va 17 ta resurs saqlandi. Dastlabki töğridan-töğri ulanişdagi ikkita HTTPS xatosi `partial` hisobotida qayd etildi. Lokal Kelişuv capture’i törtta profil, 15 resurs va nol xato bilan tugadi.

Yangi tipografika va şakl körinişida 13 ta brauzer flow’i, 24 ta WCAG holati, sakkizta maqsadli flow, 12 ta logotip tekşiruvi va 320 px ekrandagi uç til sinovi ötdi. Röyxatdan ötişdan hujjat yuklaş va murojaat yuborişgaça bölgan jarayon tekşirildi. Şu tekşiruvlarda jami 54 ta avtomatik WCAG auditida nol xato qaytdi.

`npm run test:design` töqqizta ekstraktor regressiyasini qamraydi. HTTP/fetç/iframe xatolari, keç yuklangan resurslar, bir URL’dagi turli javoblar, yönaltirilgan CSS içidagi nisbiy havolalar, xato hujjat, ikki qiya çiziqli URL yöli, parallel natija papkasi, parallel dastlabki örnatiş va Git metama’lumoti xatosida jarayon yakunlanişi tekşirildi.

Production build, ESLint, TypeScript, mavjud 12 ta regressiya testi va dependency audit ötdi. Sinov yaratgan uç hisob, bitta iş va bitta fayl identifikatorlari böyiça çiqarildi. Beş iş, tört hisob va bitta sessiya, audit zanjiri hamda 14 ta sahifa manzili qayta tekşirildi. Dizayn ölçovlari va takrorlaş buyruqlari [DESIGN.md](DESIGN.md) içida saqlangan.

## Mediator surati va narx hamda vaqt taqqoslaşi

Landing va röyxatdan ötişda `mediation-meeting.png` surati yuklanişi tekşirildi. Mediatsiya va fuqarolik sudi kartalarida mavjud hisoblaş funksiyalaridan olingan 800 000 hamda 2 000 000 sömlik qiymatlar, 30 kun va 10 kun + 1 oy bosqiçlari tekşirildi. Misol summasi 50 000 000 söm, mediator qiymati namuna tarifi va sud qiymati davlat boji sifatida berilgan.

1440, 1024, 768, 390, 360 va 320 px ekranlarda uç til böyiça 18 ta köriniş tekşirildi. Narx va muddat raqamlari kamida 40 px bölişi, karta içida siğişi va uçta rasmiy manba havolasi mavjudligi tekşirildi. Olti WCAG auditida nol xato qaytdi. Röyxatdan ötişdagi yangi surat ham yuklandi. Brauzerda JavaScript xatosi qaytmadi.

Production build, ESLint, TypeScript, 12 ta regressiya testi va mustaqil kod körigi ötdi. Audit zanjiri, 14 ta sahifa hamda mavjud beş iş, tört hisob va bitta sessiya yakuniy tekşiruvdan ötdi.

## Telefon, huquqiy yordamçi va pullik xizmatlar kengaytmasi

2026-11-21 kuni production build, TypeScript, ESLint, 45 ta regressiya testi va töqqizta dizayn ekstraktori testi ötdi. Production boğliqliklarining `npm audit --omit=dev` tekşiruvida nol zaiflik qaytdi. Olti yönaliş böyiça mustaqil kod körigi ötdi. Next.js build ESLint konfiguratsiyasidagi Next.js plagini haqida ogohlantiriş berdi, alohida ESLint tekşiruvi nol xato bilan tugadi.

Global HTTPS muhitida ikki alohida hisob bilan sakkizta guruhlangan brauzer jarayoni tekşirildi. Telefon bilan röyxatdan ötiş, ixtiyoriy email, pasport yuklaş, şaxsiy maydonlar, qarşi taraf taklifi, alohida bayon va roziliklar, törtta navbatdagi taklif hamda mediatorlar navbatiga ötiş işladi. Umumiy suhbatdagi yangi xabar boşqa hisobda yangilandi. Tölovdan oldingi hujjat çeklovi, saqlangan qoralama, buyurtma ruxsatlari va özgartirilgan maydonlarni qayta yuboriş tekşirildi.

Keç qaytgan AI töldiriş javobi boşqa nizoning maydonlariga yozilmasligi va AI ajratgan şaxsiy maydonlar qayta yuklaşda saqlanişi tekşirildi. Boşqa iştirokçi yaratgan Zoom havolasi va mediator hisobi oçiq xonada paydo bölişi frontenddagi boşqariladigan javoblar bilan tekşirildi. Tölov, SMS, Face ID va Zoom adapterlarining uziliş, parallel sörov va qayta uriniş holatlari avtomatik testlar bilan qamrab olindi.

Yordamçi sayt böyiça yöl-yöriq, katalogdagi modda va Lex.uz havolalari, xato javobdan keyin qayta uriniş, rus tilidagi savol va Escape tugmasi bilan yopiş orqali tekşirildi. 360, 768 va 1440 px ekranlardagi yangi sahifalar hamda landing uçun 18 ta axe-core WCAG auditida nol xato qaytdi. Brauzerda JavaScript xatosi qaytmadi. Kabinet va administrator oqimlari uçun sakkizta qöşimça tekşiruv va töqqizta WCAG auditi, narx hamda muddat taqqoslaşi uçun uç tilda 18 ta köriniş va oltita WCAG auditi ham ötdi.

Yakuniy tekşiruvdan söng global namoyiş muhitidagi sinov hisoblari, nizolar, buyurtmalar va uçta sinov fayli identifikatorlari böyiça çiqarildi. Asosiy lokal saqlaşdagi beşta hisob, beşta nizo va bitta sessiya boşlanğiç nusxa bilan soliştirildi. Asl yozuvlarning mazmuni böyiça moslik tasdiqlandi.

SMS, haqiqiy biometrik tekşiruv, Payme va Zoom servis sinovlari biznes hisoblari hamda kalitlar sozlanişini kutmoqda. Face ID uçun provayderga mos bridge, bank payout uçun biznes hisob-kitob sozlamasi kerak. Ommaviy namoyiş yordamçisi manbalar katalogi rejimida işlaydi. Ulaniş şartnomalari va boşlanğiç tariflar [kengaytma rejasida](KELISHUV_EXPANSION_PLAN.md), mahsulot talablari [professional promptda](KELISHUV_MASTER_PROMPT.md) berilgan.

## RAG yordamçi, taklif va nizoni yopiş, 2026-11-21

- `npm test` orqali 59 ta regressiya ötdi. Bepul limit, bir xil sörovni qayta yuboriş, xatodan keyin limitni qaytariş, notöğri cookie, Lex.uz identifikatorlari, kirill modda sarlavhalari va modeldagi manbasiz foizlar qamraldi.
- Orama BM25 korpusdagi 25 hujjat va 7 368 moddadan qidiradi. Lokal `bge-m3` embeddinglari va `qwen3-vl:8b-instruct` javobi haqiqiy sörovda tekşirildi. Iş haqi haqidagi javob Mehnat kodeksining 253 va 333-moddalariga joriy Lex.uz havolalarini qaytardi.
- Ngrok orqali yangi telefonli hisob, beş bosqiçli murojaat, töliq HTTPS taklifini nusxalaş, sahifa yangilanganda uni oliş va ikkinçi tarafning röyxatdan ötib qöşilişi tekşirildi.
- Ikkala tarafning mustaqil kelişuvni tasdiqlaşi, murojaatni qaytarib oliş, yopilgan iş arxivini oçiş va yopilgan işga yangi xabar yozişning rad etilişi tekşirildi.
- Har hisob uçun jami 10 ta sörov qabul qilindi, 11-sörov limit bilan qaytdi. Limit sahifa yangilanganda saqlandi va boşqa hisobga ta’sir qilmadi.
- Mobil qöşiliş sahifasi, yordamçi desktop sahifasi va mobil limit holatida uçta axe-core WCAG A/AA auditi xatosiz yakunlandi. Brauzerda `pageerror` qaytmadi.
- Administrator va mediatorning mavjud loginlari ngrok manzilida tekşirildi. Rol ruxsatlari va yangi yordamçi menyusi işladi.
- Sinov yozuvlari aniq identifikatorlar böyiça tozalandi. Boşqa yozuvlarning joriy holati va audit zanjiri tekşirildi. Lokal bazadagi mavjud yozuvlar saqlandi.

Jonli huquqiy qidiruv va sud materiallari qamrovi [yordamçi manbalari](ASSISTANT_DATA_SOURCES.md) hujjatida körsatilgan. Tekşiruv keng qamrovli huquqiy bençmark sifatida baholanmagan.


## GitHub va LexHackathon materiallari, 2026-yil 21-noyabr

- Asosiy HEAD nusxasida 59 test ötdi. Yangilangan nusxada 64 test ötdi.
- Rasmiy mediativ kelişuv şabloni, uzun rekvizitlar, şriftlar va avvalgi hujjat xeşlari tekşirildi.
- Alohida sahifalardagi imzo bloklari uçun sarlavha joylaşuvi regressiya testi dastlab xatoni takrorladi. Tuzatişdan söng şu test va töliq töplam ötdi.
- ESLint va TypeScript tekşiruvlari xatosiz yakunlandi.
- Sakkiz slaydli PPTX qayta import qilindi. Izohlar, 180 soniyalik vaqt taqsimoti, jadval va hisoblar tekşirildi. Paket va joylaşuv validatorlari xato hamda ogohlantiriş qaytarmadi.
- Public materiallarda yangi taqdimot, slayd rasmlari, biznes dalillari va FastAPI/Qdrant sxemasining konfiguratsiya holati berilgan.
- Production build alohida işçi nusxada ötdi. Işlab turgan namoyiş yiğmasi uşbu tekşiruvda almaştirilmadi.
- Dizayn ekstraktorining 9 regressiyasi ötdi. Metadata buzilgan holatda Git manbasini aniq katalogdan tekşiriş qöşildi.
- Yakuniy mustaqil kod körigi bloklovçi xavfsizlik yoki mantiq xatosi topmadi. Production dependency auditida 0 zaiflik qaytdi.

## Yangi yozuv, 2026-yil 21-noyabr

- Özbekça interfeys `Ğ/ğ`, `Ö/ö`, `Ş/ş` va `Ç/ç` harflariga moslandi. Logo, 1 755 ta tarjima qiymati, AI javoblari, huquqiy manba kartalari va loyiha materiallari tekşirildi.
- 66 ta regressiya testi ötdi. Yangi yozuvdagi şahar nomlari, nizo turi, huquqiy qidiruv, katta harflar, turli apostroflar, uzun Unicode matnlar, email, URL va kod belgilarining yaxlitligi qamraldi.
- AI modeliga yuboriladigan savol va kontekst identifikatorlari regressiya orqali tekşirildi. Qidiriş uçun alohida moslaştirilgan matn işlatiladi.
- Production build, ESLint va TypeScript tekşiruvlari ötdi.
- Landing, foydalanuvçi, mediator, admin, hujjatlar va şaxsni tasdiqlaş sahifalaridagi olti axe-core WCAG A/AA auditi nol xato qaytardi. Rus tiliga va özbekçaga qaytiş, 390px mobil ekran va logo matnining siğişi tekşirildi.
- Sakkiz slaydli PPTX, sakkiz sahifali taqdimot PDF va sakkiz sahifali platforma PDF qayta çiqarildi. Harflar, sahifalar, diagrammalar, havolalar va public nusxalarning xeşlari tekşirildi.
- GitHub tekşiruvida kod repozitoriysi public holatda ekanligi aniqlandi. Avvalgi topshiriqqa muvofiq u private holatiga qaytarildi. Taqdimot repozitoriysi public holatda.
- Yangi production yiğmasi 2345 va 2346 portlariga joylandi. Lokal sahifalar va ngrok’dagi HTTPS sahifa 200 javob berdi. Uçala manzilda yangi logo va sarlavha, nol brauzer xatosi tasdiqlandi.
