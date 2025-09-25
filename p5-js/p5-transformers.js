// v2.0.5
// https://www.youtube.com/watch?v=lFrpa_JSMRE&t=5280s

let pipe;
let textInput;

async function setup() {
  createCanvas(100, 100);
  background(255);

  textInput = createInput("Type something nice!");
  let submitButton = createButton("submit");
  submitButton.mousePressed(analyze);

  let { pipeline } = await import(
    "https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.3"
  );

  pipe = await pipeline(
    "sentiment-analysis",
    "Xenova/distilbert-base-uncased-finetuned-sst-2-english"
  );
}

async function analyze() {
  txt = textInput.value();
  let results = await pipe(txt);
  const { label, score } = results[0];

  createP(label);
  createP(score);
}
