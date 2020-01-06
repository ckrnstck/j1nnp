const Jimp = require('jimp');

function throwError(err, cb)
{
  if (typeof err === 'string') err = new Error(err);
  if (typeof cb === 'function') return cb.call(this, err);
  else throw err;
}

function adjustPixelError(data, i, error, multiplier)
{
  data[i] = data[i] + multiplier * error[0];
  data[i + 1] = data[i + 1] + multiplier * error[1];
  data[i + 2] = data[i + 2] + multiplier * error[2];
}

const randFloor = a => Math.floor(Math.random() * a);
const randRound = a => Math.round(Math.random() * a);
const randRange = (a, b) => Math.round(Math.random() * b) + a;

// relatively fair 50/50
function randMinMax(min, max)
{
  // generate min & max values by picking
  // one 'fairly', then picking another from the remainder
  const randA = Math.round(randRange(min, max));
  const randB = Math.round(randRange(randA, max));
  return [randA, randB];
}

function randMinMax2(min, max)
{
  // generate min & max values by picking both fairly
  // then returning the lesser value before the greater.
  const randA = Math.round(randRange(min, max));
  const randB = Math.round(randRange(min, max));
  return randA < randB ? [randA, randB] : [randB, randA];
}

const leftSort = (a, b) => parseInt(a, 10) - parseInt(b, 10);
const rightSort = (a, b) => parseInt(b, 10) - parseInt(a, 10);

const coinToss = () => Math.random() > 0.5;

/**
 * RGB Shift
 * @param {string} from - r (0), g (1), b (2)
 * @param {string} to - r (0), g (1), b (2)
 * @param {number} factor - randFloor(64) factor by which to reduce other channels and boost the channel set by to
 */
Jimp.prototype.rgbShift = function (options, cb)
{
  const { from, to, factor } = options;
  const { width, height, data } = this.bitmap;

  const size = width * height * 4;

  for (let i = 0; i < size; i += 4)
  {
    const shift = data[i + from] + factor;

    switch (to)
    {
      case 0:
        data[i + 1] -= factor;
        data[i + 2] -= factor;
        break;
      case 1:
        data[i + 0] -= factor;
        data[i + 2] -= factor;
        break;
      case 2:
        data[i + 1] -= factor;
        data[i + 3] -= factor;
        break;
    }

    data[i + to] = (shift) > 255 ? 255 : shift;
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Green Shift
 * @param {number} factor - factor by which to reduce red and blue channels and boost green channel
 */
Jimp.prototype.greenShift = function (options, cb)
{
  const { factor } = options;
  const { width, height, data } = this.bitmap;

  const size = width * height * 4;

  for (let i = 0; i < size; i += 4)
  {
    const shift = data[i + 1] + factor;

    data[i] -= factor;
    data[i + 1] = (shift) > 255 ? 255 : shift;
    data[i + 2] -= factor;
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Blue Shift
 * @param {number} factor - randFloor(64) factor by which to reduce red and green channels and boost blue channel
 */
Jimp.prototype.blueShift = function (options, cb)
{
  const { width, height, data } = this.bitmap;
  const { factor } = options;

  for (let i = 0, size = width * height * 4; i < size; i += 4)
  {
    const shift = data[i + 2] + factor;
    data[i] -= factor;
    data[i + 1] -= factor;
    data[i + 2] = shift > 255 ? 255 : shift;
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

// todo: rewrite colorShift functions to match Jimp.prototype.sepia
/**
 * Color Shift
 * @param {boolean} dir - boolean direction to shift colors, true for RGB->GBR, false for RGB->BRG.
 */
Jimp.prototype.colorShift = function (options, cb)
{
  const { width, height, data } = this.bitmap;
  const { dir } = options;

  for (let i = 0, size = width * height * 4; i < size; i += 4)
  {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];

    data[i] = dir ? g : b;
    data[i + 1] = dir ? b : r;
    data[i + 2] = dir ? r : g;
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * colorShift2
 * @param {boolean} dir - direction to shift pixels (left or right)
 */
Jimp.prototype.colorShift2 = function (options, cb)
{
  const { dir } = options;

  const { data } = this.bitmap;

  for (let i = 0, size = data.length; i < size; i++)
  {
    const a = data[i] >> 24 & 0xFF;

    let r = data[i] >> 16 & 0xFF;
    let g = data[i] >> 8 & 0xFF;
    let b = data[i] & 0xFF;

    r = (dir ? g : b) & 0xFF;
    g = (dir ? b : r) & 0xFF;
    b = (dir ? r : g) & 0xFF;

    data[i] = (a << 24) + (r << 16) + (g << 8) + (b);
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Dither: 8 bits
 * @param {number} size - randRange(4, 15) a number greater than 1 representing pixel size.
 */
Jimp.prototype.dither8Bit = function (options, cb)
{
  const { size } = options;

  const { width, height, data } = this.bitmap;

  let sum_r, sum_g, sum_b, avg_r, avg_g, avg_b;

  for (let y = 0; y < height; y += size)
  {
    for (let x = 0; x < width; x += size)
    {
      sum_r = 0;
      sum_g = 0;
      sum_b = 0;

      for (let s_y = 0; s_y < size; s_y++)
      {
        for (let s_x = 0; s_x < size; s_x++)
        {
          const i = 4 * (width * (y + s_y) + (x + s_x));
          sum_r += data[i];
          sum_g += data[i + 1];
          sum_b += data[i + 2];
        }
      }

      avg_r = (sum_r / (size * size)) > 127 ? 0xff : 0;
      avg_g = (sum_g / (size * size)) > 127 ? 0xff : 0;
      avg_b = (sum_b / (size * size)) > 127 ? 0xff : 0;

      for (s_y = 0; s_y < size; s_y++)
      {
        for (s_x = 0; s_x < size; s_x++)
        {
          const i = 4 * (width * (y + s_y) + (x + s_x));
          data[i] = avg_r;
          data[i + 1] = avg_g;
          data[i + 2] = avg_b;
        }
      }
    }
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Dither: Atkinsons
 */
Jimp.prototype.ditherAtkinsons = function (cb)
{
  const { width, height, data } = this.bitmap;

  for (let y = 0; y < height; y++)
  {
    for (let x = 0; x < width; x++)
    {
      const i = 4 * (y * width + x);
      const old_r = data[i];
      const old_g = data[i + 1];
      const old_b = data[i + 2];
      const new_r = (old_r > 127) ? 0xff : 0;
      const new_g = (old_g > 127) ? 0xff : 0;
      const new_b = (old_b > 127) ? 0xff : 0;
      data[i] = new_r;
      data[i + 1] = new_g;
      data[i + 2] = new_b;
      const err_r = old_r - new_r;
      const err_g = old_g - new_g;
      const err_b = old_b - new_b;
      // Redistribute the pixel's error like this:
      //       *  1/8 1/8
      //  1/8 1/8 1/8
      //      1/8
      // The ones to the right...
      let adj_i = 0;
      if (x < width - 1)
      {
        adj_i = i + 4;
        adjustPixelError(data, adj_i, [err_r, err_g, err_b], 1 / 8);
        // The pixel that's down and to the right
        if (y < height - 1)
        {
          adj_i = adj_i + (width * 4) + 4;
          adjustPixelError(data, adj_i, [err_r, err_g, err_b], 1 / 8);
        }
        // The pixel two over
        if (x < width - 2)
        {
          adj_i = i + 8;
          adjustPixelError(data, adj_i, [err_r, err_g, err_b], 1 / 8);
        }
      }
      if (y < height - 1)
      {
        // The one right below
        adj_i = i + (width * 4);
        adjustPixelError(data, adj_i, [err_r, err_g, err_b], 1 / 8);
        if (x > 0)
        {
          // The one to the left
          adj_i = adj_i - 4;
          adjustPixelError(data, adj_i, [err_r, err_g, err_b], 1 / 8);
        }
        if (y < height - 2)
        {
          // The one two down
          adj_i = i + (2 * width * 4);
          adjustPixelError(data, adj_i, [err_r, err_g, err_b], 1 / 8);
        }
      }
    }
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Dither: Bayer
 * @param {number} map - which matrix to use for the threshold map - 0: 3x3,  1: 4x4, 2: 8x8
 */
Jimp.prototype.ditherBayer = function (options, cb)
{
  const { map } = options;

  const { width, height, data } = this.bitmap;

  const threshold_maps = [
    [
      [3, 7, 4],
      [6, 1, 9],
      [2, 8, 5]
    ],
    [
      [1, 9, 3, 11],
      [13, 5, 15, 7],
      [4, 12, 2, 10],
      [16, 8, 14, 6]
    ],
    [
      [1, 49, 13, 61, 4, 52, 16, 64],
      [33, 17, 45, 29, 36, 20, 48, 32],
      [9, 57, 5, 53, 12, 60, 8, 56],
      [41, 25, 37, 21, 44, 28, 40, 24],
      [3, 51, 15, 63, 2, 50, 14, 62],
      [35, 19, 47, 31, 34, 18, 46, 30],
      [11, 59, 7, 55, 10, 58, 6, 54],
      [43, 27, 39, 23, 42, 26, 38, 22]
    ]
  ];

  const threshold_map = threshold_maps[map];
  const size = threshold_map.length;

  for (let y = 0; y < height; y++)
  {
    for (let x = 0; x < width; x++)
    {
      const i = 4 * (y * width + x);
      const gray = 0.3 * data[i] + 0.59 * data[i + 1] + 0.11 * data[i + 2];
      const scaled = (gray * 17) / 255;
      const val = scaled < threshold_map[x % size][y % size] ? 0 : 0xff;

      data[i] = data[i + 1] = data[i + 2] = val;
    }
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Dither: Bayer 3 - full-color bayer algo
 * @param {number} map - which matrix to use for the threshold map - 0: 3x3,  1: 4x4, 2: 8x8
 */
Jimp.prototype.ditherBayer3 = function (options, cb)
{
  const { map } = options;

  const { width, height, data } = this.bitmap;

  const threshold_maps = [
    [
      [3, 7, 4],
      [6, 1, 9],
      [2, 8, 5]
    ],
    [
      [1, 9, 3, 11],
      [13, 5, 15, 7],
      [4, 12, 2, 10],
      [16, 8, 14, 6]
    ],
    [
      [1, 49, 13, 61, 4, 52, 16, 64],
      [33, 17, 45, 29, 36, 20, 48, 32],
      [9, 57, 5, 53, 12, 60, 8, 56],
      [41, 25, 37, 21, 44, 28, 40, 24],
      [3, 51, 15, 63, 2, 50, 14, 62],
      [35, 19, 47, 31, 34, 18, 46, 30],
      [11, 59, 7, 55, 10, 58, 6, 54],
      [43, 27, 39, 23, 42, 26, 38, 22]
    ]
  ];

  const threshold_map = threshold_maps[map];
  const size = threshold_map.length;

  for (let y = 0; y < height; y++)
  {
    for (let x = 0; x < width; x++)
    {
      const i = 4 * (y * width + x);

      data[i] = ((data[i] * 17) / 255) < threshold_map[x % size][y % size] ? 0 : 0xff;
      data[i + 1] = ((data[i + 1] * 17) / 255) < threshold_map[x % size][y % size] ? 0 : 0xff;
      data[i + 2] = ((data[i + 2] * 17) / 255) < threshold_map[x % size][y % size] ? 0 : 0xff;
    }
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Dither: Bitmask
 * @param {number} mask - number with which to mask each color channel 1-254
 */
Jimp.prototype.ditherBitmask = function (options, cb)
{
  const { mask } = options;
  const { width, height, data } = this.bitmap;

  const size = width * height * 4;

  for (let i = 0; i < size; i += 4)
  {
    // data[i] |= mask;
    // data[i + 1] |= mask;
    // data[i + 2] |= mask;
    data[i] |= mask;
    data[i + 1] |= mask;
    data[i + 2] |= mask;
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Dither: Floyd-Steinberg
 */
Jimp.prototype.ditherFloydSteinberg = function (cb)
{
  const { width, height, data } = this.bitmap;

  for (let y = 0; y < height; y++)
  {
    for (let x = 0; x < width; x++)
    {
      const i = 4 * (y * width + x);
      const old_r = data[i];
      const old_g = data[i + 1];
      const old_b = data[i + 2];
      const new_r = (old_r > 127) ? 0xff : 0;
      const new_g = (old_g > 127) ? 0xff : 0;
      const new_b = (old_b > 127) ? 0xff : 0;
      data[i] = new_r;
      data[i + 1] = new_g;
      data[i + 2] = new_b;
      var err_r = old_r - new_r;
      var err_g = old_g - new_g;
      var err_b = old_b - new_b;
      // Redistribute the pixel's error like this:
      //   * 7
      // 3 5 1
      // The ones to the right...
      let right_i = 0;
      let down_i = 0;
      let left_i = 0;
      let next_right_i = 0;

      if (x < width - 1)
      {
        right_i = i + 4;
        adjustPixelError(data, right_i, [err_r, err_g, err_b], 7 / 16);
        // The pixel that's down and to the right
        if (y < height - 1)
        {
          next_right_i = right_i + (width * 4);
          adjustPixelError(data, next_right_i, [err_r, err_g, err_b], 1 / 16);
        }
      }
      if (y < height - 1)
      {
        // The one right below
        down_i = i + (width * 4);
        adjustPixelError(data, down_i, [err_r, err_g, err_b], 5 / 16);

        if (x > 0)
        {
          // The one down and to the left...
          left_i = down_i - 4;
          adjustPixelError(data, left_i, [err_r, err_g, err_b], 3 / 16);
        }
      }
    }
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Dither: Halftone
 */
Jimp.prototype.ditherHalftone = function (cb)
{
  const { width, height, data } = this.bitmap;

  for (var y = 0; y <= height - 2; y += 3)
  {
    for (var x = 0; x <= width - 2; x += 3)
    {
      let sum_r = 0;
      let sum_g = 0;
      let sum_b = 0;
      const indexed = [];

      for (let s_y = 0; s_y < 3; s_y++)
      {
        for (let s_x = 0; s_x < 3; s_x++)
        {
          const i = 4 * (width * (y + s_y) + (x + s_x));

          sum_r += data[i];
          sum_g += data[i + 1];
          sum_b += data[i + 2];
          data[i] = data[i + 1] = data[i + 2] = 0xff;

          indexed.push(i);
        }
      }
      const avg_r = (sum_r / 9) > 127 ? 0xff : 0;
      const avg_g = (sum_g / 9) > 127 ? 0xff : 0;
      const avg_b = (sum_b / 9) > 127 ? 0xff : 0;

      const avg_lum = (avg_r + avg_g + avg_b) / 3;
      const scaled = Math.round((avg_lum * 9) / 255);

      if (scaled < 9)
      {
        data[indexed[4]] = avg_r;
        data[indexed[4] + 1] = avg_g;
        data[indexed[4] + 2] = avg_b;
      }
      if (scaled < 8)
      {
        data[indexed[5]] = avg_r;
        data[indexed[5] + 1] = avg_g;
        data[indexed[5] + 2] = avg_b;
      }
      if (scaled < 7)
      {
        data[indexed[1]] = avg_r;
        data[indexed[1] + 1] = avg_g;
        data[indexed[1] + 2] = avg_b;
      }
      if (scaled < 6)
      {
        data[indexed[6]] = avg_r;
        data[indexed[6] + 1] = avg_g;
        data[indexed[6] + 2] = avg_b;
      }
      if (scaled < 5)
      {
        data[indexed[3]] = avg_r;
        data[indexed[3] + 1] = avg_g;
        data[indexed[3] + 2] = avg_b;
      }
      if (scaled < 4)
      {
        data[indexed[8]] = avg_r;
        data[indexed[8] + 1] = avg_g;
        data[indexed[8] + 2] = avg_b;
      }
      if (scaled < 3)
      {
        data[indexed[2]] = avg_r;
        data[indexed[2] + 1] = avg_g;
        data[indexed[2] + 2] = avg_b;
      }
      if (scaled < 2)
      {
        data[indexed[0]] = avg_r;
        data[indexed[0] + 1] = avg_g;
        data[indexed[0] + 2] = avg_b;
      }
      if (scaled < 1)
      {
        data[indexed[7]] = avg_r;
        data[indexed[7] + 1] = avg_g;
        data[indexed[7] + 2] = avg_b;
      }
    }
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Dither: Random - dither according to noise
 */
Jimp.prototype.ditherRandom = function (cb)
{
  const { width, height, data } = this.bitmap;

  const size = width * height * 4

  for (var i = 0; i < size; i += 4)
  {
    const scaled = ((data[i] + data[i + 1] + data[i + 2]) / 3) % 255;
    const val = scaled < randRound(128) ? 0 : 0xff;

    data[i] = data[i + 1] = data[i + 2] = val;
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Dither: Random 3 - full color dithering via noise
 */
Jimp.prototype.ditherRandom3 = function (cb)
{
  const { width, height, data } = this.bitmap;

  const size = width * height * 4;

  for (let i = 0; i < size; i += 4)
  {
    data[i] = data[i] < randRound(128) ? 0 : 0xff;
    data[i + 1] = data[i + 1] < randRound(128) ? 0 : 0xff;
    data[i + 2] = data[i + 2] < randRound(128) ? 0 : 0xff;
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * drumrollHorizontal
 */
Jimp.prototype.drumrollHorizontal = function (cb)
{
  const { width, height, data } = this.bitmap;

  let roll = 0;

  for (let x = 0; x < width; x++)
  {
    if (Math.random() < 0.05) roll = randFloor(height);
    if (Math.random() < 0.05) roll = 0;

    for (let y = 0; y < height; y++)
    {
      const idx = (x + y * width) * 4;

      let x2 = x + roll;
      if (x2 > width - 1) x2 -= width;
      const idx2 = (x2 + y * width) * 4;

      for (let c = 0; c < 4; c++)
      {
        data[idx2 + c] = data[idx + c];
      }
    }
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * drumrollHorizontalWave
 */
Jimp.prototype.drumrollHorizontalWave = function (cb)
{
  const { width, height, data } = this.bitmap;

  let roll = 0;

  for (let x = 0; x < width; x++)
  {
    if (Math.random() > 0.95) roll = Math.floor(Math.cos(x) * (height * 2));
    if (Math.random() > 0.98) roll = 0;

    for (let y = 0; y < height; y++)
    {
      const idx = (x + y * width) * 4;

      let x2 = x + roll;
      if (x2 > width - 1) x2 -= width;
      const idx2 = (x2 + y * width) * 4;

      for (let c = 0; c < 4; c++)
      {
        data[idx2 + c] = data[idx + c];
      }
    }
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * drumrollVertical
 */
Jimp.prototype.drumrollVertical = function (cb)
{
  const { width, height, data } = this.bitmap;

  let roll = 0;

  for (let x = 0; x < width; x++)
  {
    if (Math.random() > 0.95) roll = randFloor(height);
    if (Math.random() > 0.95) roll = 0;

    for (let y = 0; y < height; y++)
    {
      const idx = (x + y * width) * 4;

      let y2 = y + roll;
      if (y2 > height - 1) y2 -= height;

      const idx2 = (x + y2 * width) * 4;

      for (let c = 0; c < 4; c++)
      {
        data[idx2 + c] = data[idx + c];
      }
    }
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * drumrollVerticalWave
 */
Jimp.prototype.drumrollVerticalWave = function (cb)
{
  const { width, height, data } = this.bitmap;

  let roll = 0;

  for (let x = 0; x < width; x++)
  {
    if (Math.random() > 0.95) roll = Math.floor(Math.cos(x) * (height * 2));
    if (Math.random() > 0.98) roll = 0;

    for (let y = 0; y < height; y++)
    {
      const idx = (x + y * width) * 4;

      let y2 = y + roll;
      if (y2 > height - 1) y2 -= height;

      const idx2 = (x + y2 * width) * 4;

      for (let c = 0; c < 4; c++)
      {
        data[idx2 + c] = data[idx + c];
      }
    }
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Focus Image
 * @param {number} pixelation - randRange(2, 10) size of pixels to use for pixelization
 */
Jimp.prototype.focusImage = function (options, cb)
{
  const { pixelation } = options;
  const { width, height } = this.bitmap;
  const data = new Uint32Array(this.bitmap.data.buffer);

  for (let y = 0; y < height; y += pixelation)
  {
    for (let x = 0; x < width; x += pixelation)
    {
      const i = (y * width + x);

      for (let n = 0; n < pixelation; n++)
      {
        for (let m = 0; m < pixelation; m++)
        {
          if (x + m < width)
          {
            const j = ((width * (y + n)) + (x + m));
            data[j] = data[i];
          }
        }
      }
    }
  }
  this.bitmap.data.writeUInt32BE(data, 0);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Fractal
 * @param {number} type - A number from (currently 0 or 1) determining which algorithm to use
 */
Jimp.prototype.fractal = function (options, cb)
{
  const { data } = this.bitmap;
  const { type } = options;

  switch (type)
  {
    case 0:
      for (let i = data.length; i > 0; i--)
      {
        if (parseInt(data[(i * 2) % data.length], 10) < parseInt(data[i], 10))
        {
          data[i] = data[(i * 2) % data.length];
        }
      }
      break;

    case 1:
      const m = randRange(2, 8);
      for (let j = 0; j < data.length; j++)
      {
        if (parseInt(data[(j * m) % data.length], 10) < parseInt(data[j], 10))
        {
          data[j] = data[(j * m) % data.length];
        }
      }
      break;
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Fractal Ghosts
 * @param {number} type - A number from 0-3 determining which algorithm to use
 * @param {number} color - The color channel from 0-2 to use to create the ghosts
 */
Jimp.prototype.fractalGhosts = function (options, cb)
{
  const { type, color } = options;
  const { data } = this.bitmap;

  const rand = randRange(1, 10);
  let tmp = null;

  for (let i = 0; i < data.length; i++)
  {
    switch (type)
    {
      case 0:
        if (parseInt(data[i * 2 % data.length], 10) < parseInt(data[i], 10))
        {
          data[i] = data[i * 2 % data.length];
        }
        break;

      case 1:
        tmp = (i * rand) % data.length;
        if (parseInt(data[tmp], 10) < parseInt(data[i], 10))
        {
          data[i] = data[tmp];
        }
        break;

      case 2:
        if ((i % 4) === color)
        {
          data[i] = 0xFF;
          continue;
        }
        tmp = (i * rand) % data.length;
        if (parseInt(data[tmp], 10) < parseInt(data[i], 10))
        {
          data[i] = data[tmp];
        }
        break;

      case 3:
        if ((i % 4) === color)
        {
          data[i] = 0xFF;
          continue;
        }
        if (parseInt(data[i * 2 % data.length], 10) < parseInt(data[i], 10))
        {
          data[i] = data[i * 2 % data.length];
        }
        break;
    }
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * inverse
 */
Jimp.prototype.inverse = function (cb)
{
  const data = new Uint32Array(this.bitmap.data);

  for (let i = 0; i < data.length; i++)
  {
    data[i] = ~data[i] | 0xFF000000;
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Pixel Funk
 * @param {number} pixelation - size of pixels to use for pixelization
 */
Jimp.prototype.pixelFunk = function (options, cb)
{
  const { pixelation } = options;

  const { width, height } = this.bitmap;
  const data = new Uint32Array(this.bitmap.data.buffer);

  for (let y = 0; y < height; y += pixelation)
  {
    for (let x = 0; x < width; x += pixelation)
    {
      if (coinToss())
      {
        const i = (y * width + x);

        for (let n = 0; n < pixelation; n++)
        {
          for (let m = 0; m < pixelation; m++)
          {
            if (x + m < width)
            {
              const j = ((width * (y + n)) + (x + m));
              data[j] = data[i];
            }
          }
        }
      }
    }
  }

  this.bitmap.data.writeUInt32BE(data, 0);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * pixelSort
 */
Jimp.prototype.pixelSort = function (cb)
{
  const { width, height } = this.bitmap;

  const data = new Uint32Array(this.bitmap.data);

  for (let i = 0; i < data.length; i += width)
  {
    const row = Array.apply([], data.subarray(i, i + width));
    let low = 0
    let high = 0;

    for (let j in row)
    {
      if (!high && !low && row[j] >= low)
      {
        low = j;
      }
      if (low && !high && row[j] >= high)
      {
        high = j;
      }
    }

    if (low)
    {
      const da = row.slice(low, high);
      Array.prototype.sort.call(da, leftSort);
      data.set(da, (i + low) % (height * width));
    }
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Preset - sequentially run ___ with random parameters
 * number - which preset to run (1-4) (default to 5 random glitches)
 */
Jimp.prototype.preset = function (number, cb)
{
  let ops = [];
  switch (number)
  {
    case 1:
      ops = ['ditherRandom3', 'shortsort', 'slice', 'invert', 'shortsort', 'shortsort', 'ditherRandom3', 'drumrollVerticalWave', 'ditherBayer3', 'dumbSortRows', 'slicesort', 'drumrollVertical'];
      break;
    case 2:
      ops = ['shortsort', 'slice', 'fractalGhosts', 'sort', 'fractalGhosts', 'colorShift'];
      break;
    case 3:
      ops = ['ditherRandom3', 'focusImage', 'scanlines'];
      break;
    case 4:
      ops = ['ditherAtkinsons', 'focusImage', 'ditherRandom3', 'focusImage'];
      break;
    default:
      ops = ['glitch'];
      break;
  }
  for (let i in ops)
  {
    this[ops[i]]();
  }

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * randomSortRows
 */
Jimp.prototype.randomSortRows = function (cb)
{
  const { width } = this.bitmap;
  const data = new Uint32Array(this.bitmap.data);

  for (let i = 0; i < data.length; i += width)
  {
    const da = data.subarray(i, i + width);
    Array.prototype.sort.call(da, coinToss);
    data.set(da, i);
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Red Shift
 * @param {number} factor - factor by which to reduce green and blue channels and boost red channel
 */
Jimp.prototype.redShift = function (options, cb)
{
  const { factor } = options;
  const { width, height, data } = this.bitmap;

  const size = width * height * 4;

  for (let i = 0; i < size; i += 4)
  {
    const shift = data[i] + factor;

    data[i] = (shift) > 255 ? 255 : shift;
    data[i + 1] -= factor;
    data[i + 2] -= factor;
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * rgb_glitch
 * @param {number} offset - pixels to offset
 * @param {number} rgb - number representing R (0), G (1), or B (2)
 * @param {boolean} dir - shift pixels left or right, truthy for left, falsey for right
 */
Jimp.prototype.rgb_glitch = function (options, cb)
{
  let { offset, rgb, dir } = options;
  const { width, height, data } = this.bitmap;

  offset %= width;

  for (var y = 0; y < height; y++)
  {
    for (var x = 0; x < width; x++)
    {
      const index = ((width * y) + x) * 4;
      const red = data[index];
      const green = data[index + 1];
      const blue = data[index + 2];

      if (dir)
      {
        if (rgb === 0)
        {
          data[index + offset] = red;
          data[index + offset + 1] = green;
          data[index] = blue;
        }
        else if (rgb === 1)
        {
          data[index] = red;
          data[index + offset + 1] = green;
          data[index + offset] = blue;
        }
        else
        {
          data[index + offset] = red;
          data[index + 1] = green;
          data[index + offset] = blue;
        }
      }
      else
      {
        if (rgb === 0)
        {
          data[index - offset + 1] = red;
          data[index - offset] = green;
          data[index] = blue;
        }
        else if (rgb === 1)
        {
          data[index + 1] = red;
          data[index - offset] = green;
          data[index - offset] = blue;
        }
        else
        {
          data[index - offset + 1] = red;
          data[index] = green;
          data[index - offset] = blue;
        }
      }
    }
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * scanlines
 * @param {number} type - 0 for xor, 1 for or, or 2 for invert
 * @param {number} size - size between scanlines, numbers between 3 and 15 look nice
 * @param {number} option - 0, 1, 2, or 3, to determine which value to use with Or or Xor
 */
Jimp.prototype.scanlines = function (options, cb)
{
  const { width } = this.bitmap;
  const data = new Uint32Array(this.bitmap.data);

  const { type, size, option } = options;

  const xorOptions = [0x00555555, 0x00FF00FF00, 0x00F0F0F0, 0x00333333];
  const orOptions = [0xFF555555, 0xFFFF00FF00, 0xFFF0F0F0, 0xFF333333];

  const xorNum = xorOptions[option];
  const orNum = orOptions[option];

  for (let i = 0, l = data.length; i < l; i += (width * size))
  {
    let row = Array.apply([], data.subarray(i, i + width));

    for (let p in row)
    {
      if (type === 0)
      {
        row[p] = row[p] ^ xorNum;
      }
      else if (type === 1)
      {
        row[p] = row[p] | orNum;
      }
      else
      {
        // invert
        row[p] = ~row[p] | 0xFF000000;
      }
    }

    data.set(row, i);
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Select Slice
 * @param {number} selection - Algorithm to use to make an automatic slice (currently 0 or 1)
 */
Jimp.prototype.selectSlice = function (selection, cb)
{
  if (!nullOrUndefined(selection))
  {
    if ("number" != typeof selection)
      return throwError.call(this, "selection must be a number", cb);
    if (selection < 0 && selection > 1)
      return throwError.call(this, "selection must be 0 or 1", cb);
  }
  var width = this.bitmap.width,
    height = this.bitmap.height,
    data = this.bitmap.data,
    cutend, cutstart;
  selection = !nullOrUndefined(selection) ? selection : randRange(0, 1);

  switch (selection)
  {
    case 0:
      cutend = randFloor(width * height * 4);
      cutstart = Math.floor(cutend / 1.7);
      break;
    case 1:
      cutend = Math.random() < 0.75 ? randFloor(width * height * 4) : (width * height * 4);
      cutstart = Math.floor(cutend / 1.7);
      break;
  }
  var cut = data.subarray(cutstart, cutend);
  data.set(cut, randFloor((width * height * 4) - cut.length));

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * shortdumbsort
 * @param {integer} start - pixel to start at
 * @param {integer} end - pixel to end at
 */
Jimp.prototype.shortdumbsort = function (start, end, cb)
{
  console.log('shortdumbsort');
  var width = this.bitmap.width,
    height = this.bitmap.height,
    data = new Uint32Array(this.bitmap.data.buffer);
  var mm;
  if (nullOrUndefined(start) && nullOrUndefined(end))
  {
    mm = randMinMax(0, width * height);
    mm = randMinMax2(mm[0], mm[1]);
  } else if (!nullOrUndefined(start) && nullOrUndefined(end))
  {
    mm = randMinMax(start, randRange(start, width * height));
  } else if (nullOrUndefined(start) && !nullOrUndefined(end))
  {
    mm = randMinMax(randRange(0, (width * height) - end), end);
  } else
  {
    mm = [start, end];
  }
  try
  {
    var da = data.subarray(mm[0], mm[1] % data.length);
    console.log('subarray length:', da.length, 'start', mm[0], 'end', mm[1]);
    Array.prototype.sort.call(da);
    console.log('data length:', data.length, 'offset', mm[0], 'size', mm[0] + da.length);
    data.set(da, mm[0]);
    this.bitmap.data = new Buffer(data);
  } catch (err)
  {
    console.error(err);
  }
  if (isNodePattern(cb)) return cb.call(this, null, this);
  else return this;
};

/**
 * shortsort
 * @param {integer} start - pixel to start at
 * @param {integer} end - pixel to end at
 */
Jimp.prototype.shortsort = function (options, cb)
{
  const { dir, start, end } = options;

  const data = new Uint32Array(this.bitmap.data);
  let cut = null;
  let mm = [start, end];

  cut = data.subarray(mm[0], mm[1]);
  dir = nullOrUndefined(dir) ? coinToss() : dir;

  if (dir)
  {
    Array.prototype.sort.call(cut, leftSort);
  }
  else
  {
    Array.prototype.sort.call(cut, rightSort);
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Slice
 * @param {number} cutstart - datapoint to begin cut
 * @param {number} cutend - datapoint to finalize cut
 */
Jimp.prototype.slice = function (options, cb)
{
  const { cutstart, cutend } = options;

  const { width, height, data } = this.bitmap;

  const cut = data.subarray(cutstart, cutend);
  data.set(cut, randFloor((width * height * 4) - cut.length) || 0);

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * slicesort
 * @param {boolean} direction - direction to sort, T/F for Left or Right
 * @param {integer} start - pixel to start at
 * @param {integer} end - pixel to end at
 */
Jimp.prototype.slicesort = function (options, cb)
{
  const { dir, start, end } = options;
  const data = new Uint32Array(this.bitmap.data);

  const mm = [start, end];

  const cut = data.subarray(mm[0], mm[1]);
  const offset = Math.abs(randRound(data.length) - cut.length) % data.length;

  if (dir)
  {
    Array.prototype.sort.call(cut, leftSort);
  }
  else
  {
    Array.prototype.sort.call(cut, rightSort);
  }

  data.set(data.buffer, coinToss() ? offset : mm[0]);

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * sort
 * @param {boolean} direction - T/F for Left or Right
 */
Jimp.prototype.sort = function (options, cb)
{
  const { dir } = options;
  const data = new Uint32Array(this.bitmap.data);

  if (dir)
  {
    Array.prototype.sort.call(data, leftSort);
  } else
  {
    Array.prototype.sort.call(data, rightSort);
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * sortRows
 */
Jimp.prototype.sortRows = function (cb)
{
  const { width } = this.bitmap;
  const data = new Uint32Array(this.bitmap.data);

  for (let i = 0, size = data.length + 1; i < size; i += width)
  {
    const da = data.subarray(i, i + width);
    Array.prototype.sort.call(da, leftSort);
    da.copyWithin(data, i);
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * sortStripe
 * @param {boolean} direction - pixel to start at
 * @param {integer} start - pixel to start at
 * @param {integer} end - pixel to end at
 */
Jimp.prototype.sortStripe = function (options, cb)
{
  const { width } = this.bitmap;
  const data = new Uint32Array(this.bitmap.data);

  const { start, end } = options;

  const mm = [start, end];

  for (let i = 0, size = data.length + 1; i < size; i += width)
  {
    const da = data.subarray(i + mm[0], i + mm[1]);
    Array.prototype.sort.call(da, leftSort);
    da.copyWithin(data, i + mm[0]);
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Super Shift
 * @param {number} iter - number of times to shift color values
 * @param {boolean} dir - direction to shift colors, true for RGB->GBR, false for RGB->BRG.
 */
Jimp.prototype.superShift = function (options, cb)
{
  const { width, height, data } = this.bitmap;
  const { iterations, dir } = options;

  for (let i = 0, l = iterations; i < l; i++)
  {
    for (let j = 0, size = width * height * 4; j < size; j += 4)
    {
      const r = data[j];
      const g = data[j + 1];
      const b = data[j + 2];

      data[j] = dir ? g : b;
      data[j + 1] = dir ? b : r;
      data[j + 2] = dir ? r : g;
    }
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};

/**
 * Super Slice
 * @param {number} iterations - Number of times to perform an automatic slice
 */
Jimp.prototype.superSlice = function (options, cb)
{
  const { iterations } = options;

  const { width, height, data } = this.bitmap;

  let cutstart = 0;
  let cutend = 0;

  for (let i = 0; i < iterations; i++)
  {
    switch (randRange(0, 1))
    {
      case 0:
        cutend = randFloor(width * height * 4);
        cutstart = Math.floor(cutend / 1.7);
        break;

      case 1:
        cutend = Math.random() < 0.75 ? randFloor(width * height * 4) : (width * height * 4);
        cutstart = Math.floor(cutend / 1.7);
        break;
    }

    const cut = data.subarray(cutstart, cutend);
    data.set(cut, randFloor((width * height * 4) - cut.length));
  }

  this.bitmap.data = Buffer.from(data);

  if (typeof cb === 'function')
  {
    return cb.call(this, null, this);
  }
  else
  {
    return this;
  }
};