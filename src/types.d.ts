// an-array-of-english-words ships a plain array of ~275k lowercase words with no
// TS types. We only need the default export shape.
declare module "an-array-of-english-words" {
  const words: string[];
  export default words;
}
