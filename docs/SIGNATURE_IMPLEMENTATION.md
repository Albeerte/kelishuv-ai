# KELIŞUV AI imzo arxitekturasi

## Hujjat nusxasi

Mediator strukturali şartlar, rekvizitlar, tölov jadvali, boşqa majburiyatlar va uçta imzo joyini tayyorlaydi. Server PDF hamda DOCX yaratadi. Mazmun SHA-256 xeşi şartlar, iştirokçilar, joylaşuv, nusxa raqami va nusxa identifikatoridan hisoblanadi. Har bir fayl uçun qöşimça SHA-256 hisoblanadi.

Qölda kiritilgan şaxs va vakolat ma’lumoti mediator körigidan ötadi. Hujjatdagi maydonlar va qonuniy moslik böyiça tekşiruv röyxati körinadi. Malakali inson hujjatni yakunlaydi.

## Imzolaş

Imzolaş tartibi birinçi taraf, ikkinçi taraf va mediatordan iborat. Har biri öz hisobiga kiradi, barça PDF sahifalarini oçadi va ixtiyoriy rozilik beradi. Server nusxa va mazmun xeşiga boğlangan körik qaydini yaratadi. Sahifalarni köriş qaydi klient tasdiği hisoblanadi.

`signature_pad` yuqori DPI canvasda siçqonça, touç va pen hodisalarini qabul qiladi. Undo, clear, oldindan köriş va eksport mavjud. Qurilma bosim ma’lumotini berganda çiziq qalinligi şu ma’lumotdan qayta çiziladi. `touch-action` imzolaş maydonida tasodifiy sahifa siljişini çeklaydi.

PNG serverda dekodlanadi, ölçami va hajmi tekşiriladi. Böş tasvir rad etiladi. Imzo, vaqt, hisob, rol, rozilik matni versiyasi va mazmun xeşi saqlanadi. PDF hamda DOCX içiga imzo tasviri joylaştiriladi. Fayllar AES-256-GCM bilan saqlanadi.

## Parallel amallar va tahrir

Oğir render tranzaksiyadan taşqarida bajariladi. Natijani saqlaşda server joriy nusxa, PDF xeşi, imzolar soni, körik qaydi va mediator vakolatini qayta tekşiradi. Parallel kelgan körik qaydlari saqlanadi. Imzolangan iştirokçining körik qaydi öz imzosiga boğlangan holda saqlanadi.

Matn yoki imzo joylaşuvi tahriri yangi nusxa yaratadi. Yangi nusxa uç iştirokçidan yangidan imzo oladi. Tugallangan oldingi nusxa va unga tegişli ijro hisobotlari tarixda saqlanadi. Yakuniy imzolaşda nusxa qulflanadi, nizo hujjatlariga PDF qöşiladi va ijro rejasi oçiladi.

Ijro hisobotining sörovi dialog oçilgandagi `versionId` va noyob `requestId` bilan yuboriladi. Nusxa almaşganda server keçikkan sörovni rad etadi. Oldingi rejada işlatilgan sörov identifikatori va özgartirilgan dalil biriktirmasi bilan takrorlaş ham tekşiriladi.

## Joylaşuv

Koordinatalar sahifa ölçamiga nisbatan normallaştirilgan. Sahifa indeksi noldan boşlanadi. Pastki qismning 74–94 foizi imzo uçun ajratilgan. Server sahifa çegarasi, uçta alohida rol, minimal ölçam va ustma-ust tuşişni tekşiradi. Mediator preview ustida joyni suradi yoki sahifa va ölçamlarni kiritadi.

## Tekşiruv va huquqiy holat

Ikki sahifali yakuniy PDF rastrga render qilindi. Uç imzo, ism, vaqt, holat va xeş közdan keçirildi. Siçqonça bilan haqiqiy brauzer amallari, CDP touç hodisalari va bosim berilgan pen Pointer Events avtomatlaştirilgan sinovdan ötdi. Jismoniy sensor ekran va stilus bilan apparat sinovi hali bajarilişi kerak.

Uşbu oqim vizual qölda imzo va audit qaydini beradi. ERI, OneID hamda tegişli yuridik rasmiylaştiriş holati alohida körsatiladi. Huquqiy tadqiqot va rasmiy havolalar [SIGNING_LEGAL.md](SIGNING_LEGAL.md) hujjatida jamlangan.
