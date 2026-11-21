# MediMatch mahalliy platformasi

## Foydalanuvchi talabi

> mediatrlik boyicha bolsin mediatr bolib royhatdan otib davolarni qabul qilish va daromad topishi mumkin platformaga foiz tolab foydalanuvchilar royhatdan otib kerakli hujjatlarni yuklab va arizalarini yuklab ikki tomon ham kelishishsa va sudga arbitajga yoki mediatrga borishi kerakligi hakamlik sudiga yoki shularga borish kerakligini shuntirsa va kelishuv tugmasi orqali kelishishsa oz shaxridagi mediatrlarga bu nizo korinadi va ularga mediatr telefon qilib davo arizalarni korib chiqib beradi plan tuzib yarat internetdan biz qanday qilib lex.uzdan olamiz va berilgan nizoni ozbekistondagi qaysi qonun va huquqlarga beramiz

Ilova foydalanuvchi kompyuterida `http://localhost:2345` orqali ishlaydi.

## Jarayon

1. Fuqaro hisob ochadi, shahar va telefonini kiritadi. Nizo tavsifi, talab summasi, ariza va dalillarni yuklaydi.
2. Mahalliy huquqiy yo‘naltirish qoidalari mediatsiya, muzokara, davlat sudi, hakamlik sudi va xalqaro tijorat arbitraji shartlarini manbalari bilan ko‘rsatadi. Taraflarning maqomi va yozma arbitraj kelishuvi alohida so‘raladi.
3. Murojaatchi ikkinchi taraf emailiga bog‘langan taklif havolasini yaratadi va o‘zi ulashadi. Ikkinchi taraf alohida hisobdan o‘z bayonini va hujjatlarini qo‘shadi.
4. Har bir taraf mediatorga yo‘naltirish hamda aloqa va hujjatlarni qabul qilgan mediatorga ochishga alohida rozilik beradi. Vaqt, hisob va rozilik matni versiyasi saqlanadi.
5. Ikkala rozilikdan so‘ng anonim so‘rov ayni hudud va shahardagi tasdiqlangan, mos ixtisosli mediatorlarga chiqadi. Bu shahar filtri platformaning mahsulot qoidasidir.
6. Bitta mediator so‘rovni qabul qiladi. U ikki tarafning telefonlari, bayonlari va unga ochilgan hujjatlarni ko‘radi, qo‘ng‘iroq natijasini qayd etadi.
7. Taraflar aynan shu mediatorni o‘zaro tanlaganini tasdiqlaydi. Mediator yozma tartib-taomil kelishuvini yuklab, sessiya belgilaydi.
8. Yakunlashda taraflar imzolagan va mediator tasdiqlagan mediativ kelishuv fayli saqlanadi. Xizmat haqi tushumi va platforma komissiyasi qo‘lda qayd etiladi.

Mediatsiyani qo‘llash kelishuvi, mediatorni o‘zaro tanlash, yozma tartib-taomil kelishuvi va yakuniy mediativ kelishuv qonunning turli bosqichlaridir. Taraf ma’lumotini boshqa tarafga ochish uchun uning roziligi talab qilinadi. [O‘RQ-482, 7, 16, 19–22, 27–29-moddalar](https://lex.uz/docs/-3805227)

## Mediatorni ro‘yxatdan o‘tkazish

Mediator hisob ochadi, shahar, aloqa, ixtisos, tajriba, guvohnoma raqami, reyestr havolasi va tasdiqlovchi hujjatni yuboradi. Administrator rasmiy reyestrni qo‘lda solishtirib, tekshiruv qaydini saqlaydi va profilni faollashtiradi. Amaldagi talablar oliy ma’lumot, maxsus kurs, malaka imtihoni va reyestrga kiritilishni qamrab oladi, qonundagi imtiyozlar alohida qo‘llanadi. [O‘RQ-482, 12-modda](https://lex.uz/docs/-3805227) · [2026-yilgi 140-son qaror](https://lex.uz/docs/-8115139) · [Rasmiy reyestr](https://gov.uz/oz/adliya/sections/professional-mediatorlar-reyestri)

## Huquqiy yo‘naltirish

- Mediatsiya fuqarolik, tadbirkorlik, bank, sug‘urta, mehnat va oilaviy munosabatlarda baholanadi. Ishtirok etmayotgan uchinchi shaxslar yoki jamoat manfaatlariga daxldorlik tekshiriladi. [3-modda](https://lex.uz/docs/-3805227)
- Ichki hakamlik uchun nizoni qamrab oladigan yozma kelishuv kerak. Mehnat, oila, ma’muriy, yer va bino-inshootga egalikni belgilash nizolari hamda qonunda sanalgan davlatga aloqador talablar uchun cheklovlar mavjud. [O‘RQ-64, 5, 9, 11–13-moddalar](https://lex.uz/docs/-1072079)
- Xalqaro tijorat arbitrajida tijoriy va xalqaro bog‘liqlik hamda yozma arbitraj kelishuvi baholanadi. [O‘RQ-674, 4, 12-moddalar](https://lex.uz/docs/-5294106)
- Sud turi taraflar maqomi va talabga qarab tekshiriladi. Fuqarolik, iqtisodiy yoki ma’muriy sudga oid dastlabki yo‘nalish beriladi. Hududiy sudlov alohida tekshiriladi. [FPK](https://lex.uz/docs/-3517337) · [IPK](https://lex.uz/docs/-3523891) · [MSIYtK](https://lex.uz/docs/-3527353)

## Lex.uz ma’lumot oqimi

Tanlangan normativ moddalar rasmiy HTMLdan olinadi. Har birida haqiqiy modda identifikatori, manba havolasi, olingan vaqt, tekshirish sanasi va mazmun xeshi saqlanadi. Tahririy izohlar va o‘zgarish tarixi chiqarib tashlanadi. Yangilanishlar RSS hamda normativ mazmun xeshi orqali aniqlanadi. Yangi katalog to‘liq tayyorlangach atomar almashtiriladi. Embedding va Qdrant indekslash sozlamalar bilan alohida yoqiladi. [Lex.uz RSS](https://lex.uz/uz/rss) · [Axborot shartlari](https://lex.uz/uz/axborot)

Ochiq hujjatlashtirilgan umumiy API tadqiqotda topilmadi. Ommaviy tijoriy yuklash uchun operator bilan API yoki eksport shartlari aniqlashtiriladi. [Operator](https://lex.uz/uz/about)

## Amalga oshirish bosqichlari

- [x] Amaldagi huquqiy yo‘naltirish qoidalari va manbalar katalogi.
- [x] Ikki hisobli taklif, ikki rozilik, shahar bo‘yicha navbat va yagona qabul qilish.
- [x] Mediator arizasi, reyestrni qo‘lda tekshirish va hujjatlar maxfiyligi.
- [x] Mediator dosyesi, qo‘ng‘iroqlar, o‘zaro tanlash, yozma kelishuvlar.
- [x] Bir nizo uchun tushum va komissiya daftari.
- [x] Asosiy kirish yo‘llari, eski ma’lumotlar mosligi va ruxsatlarni tekshirish.

## Tekshirilgan natijalar

TypeScript tekshiruvi va production build o‘tdi. API uchun 131 ta integratsiya tekshiruvi bajarildi. Yana 23 ta tekshiruv eski biriktirishlarni saqlash, yangi biriktirishga rozilik, umumiy taraf qatnashadigan sessiyalar to‘qnashuvi va shahar-tuman farqini qamrab oldi. Mustaqil kod ko‘rigining tuzatishlar bo‘yicha yakuniy natijasi o‘tdi.

Brauzerda yangi murojaat, shaxsiy taklif, ikkinchi taraf bayoni, rozilik va uni qaytarib olish, mediator arizasi, administrator tasdig‘i, navbatdan qabul qilish, qo‘ng‘iroq qaydi, ish rejasi, ikki tarafning mediator tanlovi, yozma kelishuvlar, sessiya, tushum va komissiya qaydi sinovdan o‘tdi. 390 piksel mobil ko‘rinishda sahifa kengligi tekshirildi.

Lex.uz’dan 11 ta qonun va kodeksning 33 ta moddasi olindi. Havolalar, xeshlar, tahrir sanalari, tahririy izohlarni chiqarish va qo‘shimcha modda raqamlari tekshirildi. Tashqi embedding, to‘lov provayderi va elektron imzo integratsiyalari sozlangach alohida sinovdan o‘tkaziladi.

## Hisob va mahalliy integratsiyalar

Boshlang‘ich komissiya mavjud mahsulot tarifiga muvofiq 15 foiz deb olindi. Bu shartnomaviy tarif. Mediator haqining to‘lanishi va xarajatlar taraflarning kelishuviga bog‘liq. Mahalliy versiyada to‘lov tushumi va komissiya administrator qaydi bilan hisobga olinadi. [O‘RQ-482, 28-modda](https://lex.uz/docs/-3805227)

Yuklangan imzoli skanlar inson tasdig‘i bilan qayd etiladi. Elektron imzoni tekshirish va to‘lov provayderi ulanishi keyingi integratsiya sifatida qoldiriladi. Mahalliy qidiruv tanlangan moddalar katalogidan foydalanadi. Tashqi AI uchun kalitlar va xizmat sozlamalari kerak.

## Keyingi rivojlantirish

Biriktirilgan konsepsiyadagi profilaktik shartnomalar, notarial yo‘naltirish, davlat organlariga murojaatlar va korxonalar uchun nizo tugmasi asosiy mediatsiya jarayoni ishga tushgach alohida bosqichda kengaytiriladi.
