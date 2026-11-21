# Huquqiy yordamchi va ma’lumot manbalari

Yordamchi Orama BM25 qidiruvi, lokal BGE-M3 semantik qayta saralash va Ollama orqali Qwen javob yaratishidan foydalanadi. Javobga faqat qidiruvdan qaytgan manba identifikatorlari qabul qilinadi. Model ishlamasa, topilgan matnlar va umumiy yo‘naltirish ko‘rsatiladi. [Orama](https://github.com/oramasearch/orama), [BGE-M3](https://ollama.com/library/bge-m3), [Ollama](https://github.com/ollama/ollama)

Model izohidagi raqamlar va foiz qiymatlari tegishli manbada uchrashi tekshiriladi. Mos kelmagan izoh o‘rniga manbadan parcha beriladi. Ushbu tekshiruv bilan birga foydalanuvchiga qonunning asl matniga havola taqdim etiladi.

## Qamrov va yangilanish

Lokal korpus 25 ta huquqiy hujjatdagi 7 368 moddani qamrab oladi. Dastlabki nusxa 2026-yil iyul holatiga tegishli. Manba `javohirmat/uzbek-legal-corpus`, aniq revision `54902864037d1e84be557cf6ba3ef5ea132d71ac`. Ma’lumot CC0-1.0 litsenziyasida tarqatilgan. Har bir faylning SHA-256 qiymati korpus metama’lumotlarida saqlanadi. [Korpus va litsenziya](https://github.com/javohirmat/uzbek-legal-corpus)

So‘rov vaqtida tanlangan moddalar Lex.uz dan olinadi. Qo‘shimcha hujjatlar Lex.uz qidiruvi orqali topiladi. Joriy sahifadan olingan matnlar olti soat keshlanadi. Kuchini yo‘qotgan hujjatlar joriy dalil sifatida chiqarilmaydi. Jonli so‘rov muvaffaqiyatsiz bo‘lsa, karta saqlangan nusxa sanasini ko‘rsatadi. Har bir javob manba havolasi va tekshirilgan yoki saqlangan sana bilan beriladi. [Lex.uz](https://lex.uz/)

Oliy sudning fuqarolik ishlari bo‘yicha Plenum ro‘yxati tegishli qarorlarni topishga xizmat qiladi. Qaror matni Lex.uz dan tekshiriladi. `sud.uz` ochiq maqolalari qo‘shimcha amaliy material sifatida beriladi. Kartalar qonun, Plenum qarori va sud amaliyotiga oid maqolani alohida belgilaydi. [Plenum ro‘yxati](https://sud.uz/la/plenum-la/documents-civil-la/), [Oliy sud ochiq materiallari](https://sud.uz/)

`public.sud.uz` dagi individual sud qarorlari bazasiga ulanish ushbu muhitda tekshirilmadi. Sud amaliyoti qamrovi yuqoridagi ochiq materiallardan iborat. Qidiruvning 25 hujjatli lokal qamrovi Lex.uz jonli qidiruvi bilan kengayadi. Manbalarga kirish va savolning aniqligi javob qamroviga ta’sir qiladi.

## Ochiq kod va litsenziyalar

| Qism | Ishlatilishi | Litsenziya |
| --- | --- | --- |
| `@orama/orama` 3.1.18 | BM25 indeks va qidiruv | Apache-2.0 |
| `cheerio` 1.2.0 | Lex.uz va Oliy sud HTML matnini ajratish | MIT |
| Uzbek legal corpus | Moddalar va hujjatlar katalogi | CC0-1.0 |
| Ollama | Lokal model serveri | MIT |
| BGE-M3 | Ko‘p tilli matn embeddinglari | MIT |

Paket litsenziyalari o‘rnatilgan `node_modules` tarkibida mavjud. Korpus litsenziyasi `docs/licenses/uzbek-legal-corpus-CC0.txt` faylida saqlangan. [Cheerio](https://github.com/cheeriojs/cheerio), [BGE-M3 modeli](https://huggingface.co/BAAI/bge-m3)

## Lokal ishga tushirish

```powershell
ollama pull qwen3-vl:8b-instruct
ollama pull bge-m3
npm run assistant:sync
npm run build
npm start
```

`.env.local` ichida `AI_PROVIDER=OLLAMA`, `AI_MODEL=qwen3-vl:8b-instruct` va `AI_EMBEDDING_MODEL=bge-m3` sozlanadi. `AI_RAG_EMBEDDINGS=false` holatida BM25 qidiruvi ishlaydi. Korpusni yangilashdan keyin ilovani qayta yig‘ish kerak.

## Bepul limit va maxfiylik

Har bir hisob uchun jami 10 ta muvaffaqiyatli so‘rov ajratilgan. Hisobga kirmagan tashrifchi uchun limit imzolangan HttpOnly cookie orqali shu brauzerga bog‘lanadi. Limit avtomatik yangilanmaydi. Davom etayotgan so‘rov vaqtincha joy band qiladi. Texnik xato bilan tugagan so‘rov joyi qaytariladi. Bir xil `requestId` bilan takrorlash ikkinchi marta hisoblanmaydi.

Yordamchi shaxsiy ishlar yoki yuklangan hujjatlarni o‘qimaydi. Savol va ikki oldingi savol kontekst sifatida ishlatiladi. Lex.uz va Oliy sudga yuboriladigan qidiruvlar umumiy mavzu so‘zlaridan tuziladi. Tashqi generativ modelga savol yuborish foydalanuvchining alohida roziligiga bog‘langan. Embedding so‘rovlari faqat lokal Ollama manziliga yuboriladi.

## Taklif va nizoni yakunlash

Takliflar to‘liq HTTPS havolasi bilan yaratiladi va murojaatchi sahifani yangilaganda qayta yuklanadi. Qarshi taraf taklifdagi telefon yoki emailga mos hisob orqali qo‘shiladi. Telefonli taklifda shaxsiy token va mos hisob talab qilinadi. SMS tasdiqlash holati profilda o‘z holicha saqlanadi.

Taraf o‘z murojaatini qaytarib olib nizoni yopishi mumkin. Mustaqil kelishuv sababli yopishda qo‘shilgan ikkinchi tarafning tasdig‘i olinadi. Yopish tarixi saqlanadi va rejalashtirilgan ichki sessiyalar bekor qilinadi. Ish hujjatlari va oldingi to‘lov yozuvlari arxivda mavjud bo‘ladi.
