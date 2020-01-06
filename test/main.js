const Jimp = require('jimp');
const { expect, assert } = require('chai');

require('../src/glitches');

describe("smoke test", async () =>
{
  const base64Image = require('./file.js');

  const buffer = Buffer.from(base64Image, 'base64');
  const image = await Jimp.read(buffer);

  const offset = Math.ceil(Math.random() * 1000);
  const rgb = Math.floor(Math.random() * 3);

  await image.rgb_glitch({ offset, rgb, dir: false });

  await image.drumrollVerticalWave();

  await image.writeAsync('./test.png');
});