# KELISHUV AI imzo arxitekturasi

## Hujjat nusxasi

Mediator strukturali shartlar, rekvizitlar, to‘lov jadvali, boshqa majburiyatlar va uchta imzo joyini tayyorlaydi. Server PDF hamda DOCX yaratadi. Mazmun SHA-256 xeshi shartlar, ishtirokchilar, joylashuv, nusxa raqami va nusxa identifikatoridan hisoblanadi. Har bir fayl uchun qo‘shimcha SHA-256 hisoblanadi.

Qo‘lda kiritilgan shaxs va vakolat ma’lumoti mediator ko‘rigidan o‘tadi. Hujjatdagi maydonlar va qonuniy moslik bo‘yicha tekshiruv ro‘yxati ko‘rinadi. Malakali inson hujjatni yakunlaydi.

## Imzolash

Imzolash tartibi birinchi taraf, ikkinchi taraf va mediatordan iborat. Har biri o‘z hisobiga kiradi, barcha PDF sahifalarini ochadi va ixtiyoriy rozilik beradi. Server nusxa va mazmun xeshiga bog‘langan ko‘rik qaydini yaratadi. Sahifalarni ko‘rish qaydi klient tasdig‘i hisoblanadi.

`signature_pad` yuqori DPI canvasda sichqoncha, touch va pen hodisalarini qabul qiladi. Undo, clear, oldindan ko‘rish va eksport mavjud. Qurilma bosim ma’lumotini berganda chiziq qalinligi shu ma’lumotdan qayta chiziladi. `touch-action` imzolash maydonida tasodifiy sahifa siljishini cheklaydi.

PNG serverda dekodlanadi, o‘lchami va hajmi tekshiriladi. Bo‘sh tasvir rad etiladi. Imzo, vaqt, hisob, rol, rozilik matni versiyasi va mazmun xeshi saqlanadi. PDF hamda DOCX ichiga imzo tasviri joylashtiriladi. Fayllar AES-256-GCM bilan saqlanadi.

## Parallel amallar va tahrir

Og‘ir render tranzaksiyadan tashqarida bajariladi. Natijani saqlashda server joriy nusxa, PDF xeshi, imzolar soni, ko‘rik qaydi va mediator vakolatini qayta tekshiradi. Parallel kelgan ko‘rik qaydlari saqlanadi. Imzolangan ishtirokchining ko‘rik qaydi o‘z imzosiga bog‘langan holda saqlanadi.

Matn yoki imzo joylashuvi tahriri yangi nusxa yaratadi. Yangi nusxa uch ishtirokchidan yangidan imzo oladi. Tugallangan oldingi nusxa va unga tegishli ijro hisobotlari tarixda saqlanadi. Yakuniy imzolashda nusxa qulflanadi, nizo hujjatlariga PDF qo‘shiladi va ijro rejasi ochiladi.

Ijro hisobotining so‘rovi dialog ochilgandagi `versionId` va noyob `requestId` bilan yuboriladi. Nusxa almashganda server kechikkan so‘rovni rad etadi. Oldingi rejada ishlatilgan so‘rov identifikatori va o‘zgartirilgan dalil biriktirmasi bilan takrorlash ham tekshiriladi.

## Joylashuv

Koordinatalar sahifa o‘lchamiga nisbatan normallashtirilgan. Sahifa indeksi noldan boshlanadi. Pastki qismning 74–94 foizi imzo uchun ajratilgan. Server sahifa chegarasi, uchta alohida rol, minimal o‘lcham va ustma-ust tushishni tekshiradi. Mediator preview ustida joyni suradi yoki sahifa va o‘lchamlarni kiritadi.

## Tekshiruv va huquqiy holat

Ikki sahifali yakuniy PDF rastrga render qilindi. Uch imzo, ism, vaqt, holat va xesh ko‘zdan kechirildi. Sichqoncha bilan haqiqiy brauzer amallari, CDP touch hodisalari va bosim berilgan pen Pointer Events avtomatlashtirilgan sinovdan o‘tdi. Jismoniy sensor ekran va stilus bilan apparat sinovi hali bajarilishi kerak.

Ushbu oqim vizual qo‘lda imzo va audit qaydini beradi. ERI, OneID hamda tegishli yuridik rasmiylashtirish holati alohida ko‘rsatiladi. Huquqiy tadqiqot va rasmiy havolalar [SIGNING_LEGAL.md](SIGNING_LEGAL.md) hujjatida jamlangan.
