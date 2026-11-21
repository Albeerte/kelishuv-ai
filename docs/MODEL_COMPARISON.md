# KELIŞUV AI model tanlovi

Tekşiriş sanasi 2026-11-20. Uşbu hisobot mavjud lokal loyiha, rasmiy model kartalari va provayder hujjatlariga asoslangan.

## Maşinada mavjud imkoniyat

`http://127.0.0.1:11434/api/tags` sörovi muvaffaqiyatli bajarildi. Ollama quyidagi örnatilgan modellarni qaytardi. Hajmlar model fayllarining API bildirgan baytlaridir.

| Model aliasi | Hajm | Amaliy tanlov |
| --- | --- | --- |
| `qwen3-vl:8b-instruct` | 6,190,971,795 bayt | Lokal matn va tasvir tahlili uçun boşlanğiç model |
| `qwen3-vl:8b` | 6,140,415,879 bayt | Muqobil mavjud variant, alohida baholaş kerak |
| `qwen3.8:27b` | 17,741,872,154 bayt | Oğirroq tajriba nomzodi, aynan uşbu aliasning kelib çiqişi va litsenziyasi keyingi tekşiruvga boğliq |
| `deepseek-r1:1.5b` | 1,117,322,768 bayt | Yengil çiqariş tajribasi uçun nomzod |
| `gemma3:1b` | 806,067,407 bayt | Yengil tajriba nomzodi, model şartlari alohida tekşiriladi |

Röyxatni öqiş va mavjud modelga ikki sintetik sörov bilan tekşiriş bajarildi.

## Provayder va model taqqoslanişi

Kontekst qiymatlari rasmiy kartadagi maksimumdir. Işlatiladigan server, kvantlaş va mavjud xotira amaliy çegarani belgilaydi. Özbek huquqiy aniqligi uşbu kartalardagi umumiy köp tillilik natijalaridan alohida baholanadi.

| Ekotizim va tekşirilgan model | Kontekst va hujjat tahlili | Strukturali natija | Litsenziya va tijoriy qöllaş | Xarajat, maxfiylik va integratsiya qarori |
| --- | --- | --- | --- | --- |
| OpenAI `gpt-6.2-sol` | 1.05M kontekst, matn va tasvir kirişi | JSON Sçema asosidagi Structured Outputs | Yopiq servis modeli, API şartlari asosida foydalaniş | Tekşirilgan katalogda 1M kiriş tokeni $2 va çiqiş tokeni $10. Taşqi servis uçun ma’lumot oqimi va hisob sozlamalari kerak. Muqobil adapter nomzodi. [Katalog](https://developers.openai.com/api/docs/models) · [Strukturali natija](https://developers.openai.com/api/docs/guides/structured-outputs) |
| Anthropic `claude-sonnet-5-5` | 1M kontekst, matn va tasvir, 128K maksimum çiqiş | `output_config.format` orqali JSON Sçema, sxema çeklovlari mavjud | Yopiq tijoriy servis, Commercial Terms asosida | Katalogda 1M kiriş tokeni $2 va çiqiş tokeni $10. Rasmiy tezlik taqqoslaşida Fast holati berilgan. Lokal ölçov bajarilmagan. Alohida Messages API adapteri orqali ulanadi. [Katalog](https://platform.claude.com/docs/en/models/overview) · [JSON sxema](https://platform.claude.com/docs/en/build-with-claude/structured-outputs) |
| Google Gemini 4 oilasi, `gemini-4-hydrogen` | Rasmiy katalogda 1M kontekst, matn, tasvir, audio, video va PDF | Gemini JSON Sçema çiqişi alohida capability tekşiruvi bilan ulanadi | Yopiq API, Gemini API Additional Terms | Faollaştirişda amaldagi tarif va region tekşiriladi. Paid Services ma’lumot qoidalari va maxfiy materialga oid şartlar tekşiriladi. [Katalog](https://aistudio.google.com/docs/models) · [Strukturali çiqiş](https://aistudio.google.com/docs/structured-output) · [Şartlar](https://aistudio.google.com/docs/terms) |
| Qwen `Qwen3-VL-8B-Instruct` | Konfiguratsiyada 262,144 pozitsiya, matn va tasvir, kartada 32 tilli OCR körsatilgan | Ollama `format` maydoniga JSON Sçema beriş amalda tekşirildi | Rasmiy model kartasida Apaçe-2.0. Litsenziya va tegişli bildirişnomalar tarqatişda saqlanadi | Örnatilgan aliasdan lokal foydalaniş tanlandi. Hisoblaş xarajati kompyuter resurslariga boğliq. Modelga API token tölovi talab qilinadigan taşqi sörov yuborilmadi. [Karta](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct) · [Konfiguratsiya](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct/raw/main/config.json) · [Ollama sxemalari](https://ollama.com/blog/structured-outputs) |
| Meta `Llama-4-Scout-17B-16E-Instruct` | Karta uzoq kontekst va multimodal işlaşni hujjatlaştiradi, e’lon qilingan kontekst 10M | Tanlangan inference serverning sxema yoki constrained decoding imkoniyatiga boğliq | Llama 4 Community License. Attribution, Acceptable Use Policy va 700M MAU şarti mavjud | Kattaroq server resurslarini talab qiladi. Uşbu maşinada örnatilgani aniqlanmadi. Lokal MVP uçun qöşimça yuklaş tanlanmadi. [Model va litsenziya](https://huggingface.co/meta-llama/Llama-4-Scout-17B-16E-Instruct) |
| Mistral `Mistral-Small-3.2-24B-Instruct-2506` | 131,072 pozitsiya, matn va tasvir, kartada 24 til | Model kartasi vosita çaqirişni körsatadi, JSON kafolati inference server bilan tekşiriladi | Rasmiy kartada Apaçe-2.0 | Self-host qiliş uçun model va xotira resurslari kerak. Mavjud 8B Qwen bilan soliştiruvçi keyingi nomzod. [Karta](https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506) · [Konfiguratsiya](https://huggingface.co/mistralai/Mistral-Small-3.2-24B-Instruct-2506/raw/main/config.json) |
| Hugging Face Hub va inference vositalari | Hub model kartasi va versiyasini saqlaydi, Transformers yoki vLLM orqali xizmat qiliş mumkin | Natija sxemasi tanlangan model va serverga boğliq | Har bir model kartasining öz litsenziyasi bor, Hub nomi barça modellarga yagona tijoriy ruxsat bermaydi | Qwen, Mistral va Llama kartalarida modelga xos deploy körsatmalari tekşirildi. Boşqa modelga ötişda aynan şu modelning şartlari tekşiriladi. [Qwen deploy kartasi](https://huggingface.co/Qwen/Qwen3-VL-8B-Instruct) |

OpenAI API ma’lumotlari uçun saqlaş va nazorat sozlamalari endpointga qarab baholanadi. Anthropic tijoriy API ma’lumotlarini standart holatda model öqitişiga işlatmasligini bildiradi. Har bir servisdagi retention va joylaşuv şartlari alohida konfiguratsiya tekşiruvidan ötadi. [OpenAI ma’lumot nazorati](https://developers.openai.com/api/docs/guides/your-data) · [Anthropic tijoriy ma’lumotlari](https://privacy.claude.com/en/articles/7996868-is-my-data-used-for-model-training)

## Özbekça amaliy tekşiruv

Örnatilgan `qwen3-vl:8b-instruct` uçun 2026-11-20 kuni ikki sintetik qarz bayoni yuborildi. Birinçisi özbek lotinida, ikkinçisi özbek kirillida edi. Har ikkisi 1,200,000 sömlik talabni va tölov muddati muhokamasini ifodaladi. Natija sxemasida `category`, `amount` va `summary` talab qilindi. Sinov faqat sintetik faktlardan foydalandi.

| Parametr yoki natija | Özbek lotin | Özbek kirill |
| --- | --- | --- |
| `num_ctx` | 2048 | 2048 |
| `num_predict` | 160 | 160 |
| `temperature` | 0 | 0 |
| Talab qilingan uç maydon | Qaytdi | Qaytdi |
| Ajratilgan summa | 1,200,000, töğri | 1,200,000, töğri |
| Böş bölmagan qisqa bayon | Qaytdi | Qaytdi |
| Töliq sörov vaqti | 7.40 soniya | 0.76 soniya |
| API bildirgan modelni yuklaş vaqti | 6.68 soniya | 0.00 soniya |
| Generatsiya tokenlari | 64 | 78 |

Bu ikki yozuv tuzilgan ma’lumot çiqariş böyiça smoke sinovidir. Katta hujjatlar, rusça huquqiy bayonlar, qarama-qarşi dalillar, qölyozma va yuridik asoslaş böyiça aniqlik darajasi keyingi baholaşda ölçanadi. Özbekiston huquqi uçun eng mos modelni tanlaş şu kengroq baholaş natijalariga boğliq.

## Tanlangan arxitektura

Boşlanğiç lokal adapter Ollama va mavjud `qwen3-vl:8b-instruct` bilan işlaydi. Mavjud qoidaviy yönaltiriş va rasmiy manbalar katalogi tayanç qatlam bölib qoladi. Javob metama’lumotida haqiqiy bajarilgan rejim, model nomi va manbalar qayd etiladi. LLM javobi olingan holat va mahalliy qoidaviy natija interfeysda alohida aniq nom bilan körsatiladi.

Yagona `runStructuredAI` şartnomasi sxema, xabarlar, ruxsat etilgan tasvirlar va vaqt çegarasini qabul qiladi. Lokal Ollama va OpenAI-compatible server şakllari adapter içida moslaştiriladi. Çiqiş serverda Zod bilan qayta tekşiriladi. Törtta taklif soni, sonli qiymatlar va manba identifikatorlari biznes qoidalari bilan tekşiriladi.

Umumiy kelişuv takliflariga ikkala tarafga oçilgan ma’lumotlar beriladi. Mediatorning maxfiy dosyesi va tarafning şaxsiy tahlili auditoriyasi alohida belgilanadi. Maxfiy matnlar prompt, javob yoki xato loglariga yoziladigan diagnostika tarkibidan çiqariladi. Taşqi provayderga yuboriş ma’lumot egasining tegişli roziligi, operatorning huquqiy asosi va texnik sozlamalari orqali boşqariladi. Huquqiy şartlar [imzolaş va ma’lumot hujjatida](SIGNING_LEGAL.md) keltirilgan.

## Keyingi baholaş töplami

- Özbek lotin, özbek kirill va rus tillarida bir xil mazmundagi kamida 20 ta sintetik nizo.
- Sana, summa va majburiyatlar uçun tekşiriladigan kutilgan qiymatlar.
- Maxfiy çegara va strategiyalarni umumiy javobga olib çiqişga urinişlar.
- Rasmiy katalogda mavjud manbalarni tanlaş va yetişmayotgan manbani belgilaş.
- Törtta taklifning betarafligi, sxemaga mosligi va hisob-kitoblari.
- Sovuq işga tuşiş, iliq sörov va katta hujjatlarda keçikiş.
- Malakali mediator tomonidan huquqiy va til böyiça körik.

Model va tariflar faollaştiriş vaqtida rasmiy katalog bilan qayta tekşiriladi. Mahalliy ölçovlar faqat uşbu maşina va körsatilgan sinov parametrlariga tegişli.
