# Huquqiy yordamçi va ma’lumot manbalari

Yordamçi Orama BM25 qidiruvi, lokal BGE-M3 semantik qayta saralaş va Ollama orqali Qwen javob yaratişidan foydalanadi. Javobga faqat qidiruvdan qaytgan manba identifikatorlari qabul qilinadi. Model işlamasa, topilgan matnlar va umumiy yönaltiriş körsatiladi. [Orama](https://github.com/oramasearch/orama), [BGE-M3](https://ollama.com/library/bge-m3), [Ollama](https://github.com/ollama/ollama)

Model izohidagi raqamlar va foiz qiymatlari tegişli manbada uçraşi tekşiriladi. Mos kelmagan izoh örniga manbadan parça beriladi. Uşbu tekşiruv bilan birga foydalanuvçiga qonunning asl matniga havola taqdim etiladi.

## Qamrov va yangilaniş

Lokal korpus 25 ta huquqiy hujjatdagi 7 368 moddani qamrab oladi. Dastlabki nusxa 2026-yil iyul holatiga tegişli. Manba `javohirmat/uzbek-legal-corpus`, aniq revision `54902864037d1e84be557cf6ba3ef5ea132d71ac`. Ma’lumot CC0-1.0 litsenziyasida tarqatilgan. Har bir faylning SHA-256 qiymati korpus metama’lumotlarida saqlanadi. [Korpus va litsenziya](https://github.com/javohirmat/uzbek-legal-corpus)

Sörov vaqtida tanlangan moddalar Lex.uz dan olinadi. Qöşimça hujjatlar Lex.uz qidiruvi orqali topiladi. Joriy sahifadan olingan matnlar olti soat keşlanadi. Kuçini yöqotgan hujjatlar joriy dalil sifatida çiqarilmaydi. Jonli sörov muvaffaqiyatsiz bölsa, karta saqlangan nusxa sanasini körsatadi. Har bir javob manba havolasi va tekşirilgan yoki saqlangan sana bilan beriladi. [Lex.uz](https://lex.uz/)

Oliy sudning fuqarolik işlari böyiça Plenum röyxati tegişli qarorlarni topişga xizmat qiladi. Qaror matni Lex.uz dan tekşiriladi. `sud.uz` oçiq maqolalari qöşimça amaliy material sifatida beriladi. Kartalar qonun, Plenum qarori va sud amaliyotiga oid maqolani alohida belgilaydi. [Plenum röyxati](https://sud.uz/la/plenum-la/documents-civil-la/), [Oliy sud oçiq materiallari](https://sud.uz/)

`public.sud.uz` dagi individual sud qarorlari bazasiga ulaniş uşbu muhitda tekşirilmadi. Sud amaliyoti qamrovi yuqoridagi oçiq materiallardan iborat. Qidiruvning 25 hujjatli lokal qamrovi Lex.uz jonli qidiruvi bilan kengayadi. Manbalarga kiriş va savolning aniqligi javob qamroviga ta’sir qiladi.

## Oçiq kod va litsenziyalar

| Qism | Işlatilişi | Litsenziya |
| --- | --- | --- |
| `@orama/orama` 3.1.18 | BM25 indeks va qidiruv | Apaçe-2.0 |
| `cheerio` 1.2.0 | Lex.uz va Oliy sud HTML matnini ajratiş | MIT |
| Uzbek legal corpus | Moddalar va hujjatlar katalogi | CC0-1.0 |
| Ollama | Lokal model serveri | MIT |
| BGE-M3 | Köp tilli matn embeddinglari | MIT |

Paket litsenziyalari örnatilgan `node_modules` tarkibida mavjud. Korpus litsenziyasi `docs/licenses/uzbek-legal-corpus-CC0.txt` faylida saqlangan. [Çeerio](https://github.com/cheeriojs/cheerio), [BGE-M3 modeli](https://huggingface.co/BAAI/bge-m3)

## Lokal işga tuşiriş

```powershell
ollama pull qwen3-vl:8b-instruct
ollama pull bge-m3
npm run assistant:sync
npm run build
npm start
```

`.env.local` içida `AI_PROVIDER=OLLAMA`, `AI_MODEL=qwen3-vl:8b-instruct` va `AI_EMBEDDING_MODEL=bge-m3` sozlanadi. `AI_RAG_EMBEDDINGS=false` holatida BM25 qidiruvi işlaydi. Korpusni yangilaşdan keyin ilovani qayta yiğiş kerak.

## Bepul limit va maxfiylik

Har bir hisob uçun jami 10 ta muvaffaqiyatli sörov ajratilgan. Hisobga kirmagan taşrifçi uçun limit imzolangan HttpOnly cookie orqali şu brauzerga boğlanadi. Limit avtomatik yangilanmaydi. Davom etayotgan sörov vaqtinça joy band qiladi. Texnik xato bilan tugagan sörov joyi qaytariladi. Bir xil `requestId` bilan takrorlaş ikkinçi marta hisoblanmaydi.

Yordamçi şaxsiy işlar yoki yuklangan hujjatlarni öqimaydi. Savol va ikki oldingi savol kontekst sifatida işlatiladi. Lex.uz va Oliy sudga yuboriladigan qidiruvlar umumiy mavzu sözlaridan tuziladi. Taşqi generativ modelga savol yuboriş foydalanuvçining alohida roziligiga boğlangan. Embedding sörovlari faqat lokal Ollama manziliga yuboriladi.

## Taklif va nizoni yakunlaş

Takliflar töliq HTTPS havolasi bilan yaratiladi va murojaatçi sahifani yangilaganda qayta yuklanadi. Qarşi taraf taklifdagi telefon yoki emailga mos hisob orqali qöşiladi. Telefonli taklifda şaxsiy token va mos hisob talab qilinadi. SMS tasdiqlaş holati profilda öz holiça saqlanadi.

Taraf öz murojaatini qaytarib olib nizoni yopişi mumkin. Mustaqil kelişuv sababli yopişda qöşilgan ikkinçi tarafning tasdiği olinadi. Yopiş tarixi saqlanadi va rejalaştirilgan içki sessiyalar bekor qilinadi. Iş hujjatlari va oldingi tölov yozuvlari arxivda mavjud böladi.
