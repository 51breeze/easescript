// Type definitions for non-npm package Node.js 16.18
// Project: https://nodejs.org/
// Definitions by: Microsoft TypeScript <https://github.com/Microsoft>
//                 DefinitelyTyped <https://github.com/DefinitelyTyped>
//                 Alberto Schiabel <https://github.com/jkomyno>
//                 Alvis HT Tang <https://github.com/alvis>
//                 Andrew Makarov <https://github.com/r3nya>
//                 Benjamin Toueg <https://github.com/btoueg>
//                 Chigozirim C. <https://github.com/smac89>
//                 David Junger <https://github.com/touffy>
//                 Deividas Bakanas <https://github.com/DeividasBakanas>
//                 Eugene Y. Q. Shen <https://github.com/eyqs>
//                 Hannes Magnusson <https://github.com/Hannes-Magnusson-CK>
//                 Huw <https://github.com/hoo29>
//                 Kelvin Jin <https://github.com/kjin>
//                 Klaus Meinhardt <https://github.com/ajafff>
//                 Lishude <https://github.com/islishude>
//                 Mariusz Wiktorczyk <https://github.com/mwiktorczyk>
//                 Mohsen Azimi <https://github.com/mohsen1>
//                 Nicolas Even <https://github.com/n-e>
//                 Nikita Galkin <https://github.com/galkin>
//                 Parambir Singh <https://github.com/parambirs>
//                 Sebastian Silbermann <https://github.com/eps1lon>
//                 Seth Westphal <https://github.com/westy92>
//                 Simon Schick <https://github.com/SimonSchick>
//                 Thomas den Hollander <https://github.com/ThomasdenH>
//                 Wilco Bakker <https://github.com/WilcoBakker>
//                 wwwy3y3 <https://github.com/wwwy3y3>
//                 Samuel Ainsworth <https://github.com/samuela>
//                 Kyle Uehlein <https://github.com/kuehlein>
//                 Thanik Bhongbhibhat <https://github.com/bhongy>
//                 Marcin Kopacz <https://github.com/chyzwar>
//                 Trivikram Kamat <https://github.com/trivikr>
//                 Junxiao Shi <https://github.com/yoursunny>
//                 Ilia Baryshnikov <https://github.com/qwelias>
//                 ExE Boss <https://github.com/ExE-Boss>
//                 Piotr Błażejewicz <https://github.com/peterblazejewicz>
//                 Anna Henningsen <https://github.com/addaleax>
//                 Victor Perin <https://github.com/victorperin>
//                 Yongsheng Zhang <https://github.com/ZYSzys>
//                 NodeJS Contributors <https://github.com/NodeJS>
//                 Linus Unnebäck <https://github.com/LinusU>
//                 wafuwafu13 <https://github.com/wafuwafu13>
// Definitions: https://github.com/DefinitelyTyped/DefinitelyTyped

/**
 * License for programmatically and manually incorporated
 * documentation aka. `JSDoc` from https://github.com/nodejs/node/tree/master/doc
 *
 * Copyright Node.js contributors. All rights reserved.
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to
 * deal in the Software without restriction, including without limitation the
 * rights to use, copy, modify, merge, publish, distribute, sublicense, and/or
 * sell copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS
 * IN THE SOFTWARE.
 */

// NOTE: These definitions support NodeJS and TypeScript 4.9+.

declare type bigint = Number;

// Base definitions for all NodeJS modules that are not specific to any version of TypeScript:

/// <reference file="assert.d.es" />
/// <reference file="assert/strict.d.es" />
/// <reference file="globals.d.es" />
/// <reference file="async_hooks.d.es" />
/// <reference file="buffer.d.es" />
/// <reference file="child_process.d.es" />
/// <reference file="cluster.d.es" />
/// <reference file="console.d.es" />
/// <reference file="constants.d.es" />
/// <reference file="crypto.d.es" />
/// <reference file="dgram.d.es" />
/// <reference file="diagnostics_channel.d.es" />
/// <reference file="dns.d.es" />
/// <reference file="dns/promises.d.es" />
/// <reference file="dns/promises.d.es" />
/// <reference file="domain.d.es" />
/// <reference file="events.d.es" />
/// <reference file="fs.d.es" />
/// <reference file="fs/promises.d.es" />
/// <reference file="http.d.es" />
/// <reference file="http2.d.es" />
/// <reference file="https.d.es" />
/// <reference file="inspector.d.es" />
/// <reference file="module.d.es" />
/// <reference file="net.d.es" />
/// <reference file="os.d.es" />
/// <reference file="path.d.es" />
/// <reference file="perf_hooks.d.es" />
/// <reference file="process.d.es" />
/// <reference file="punycode.d.es" />
/// <reference file="querystring.d.es" />
/// <reference file="readline.d.es" />
/// <reference file="repl.d.es" />
/// <reference file="stream.d.es" />
/// <reference file="stream/promises.d.es" />
/// <reference file="stream/consumers.d.es" />
/// <reference file="stream/web.d.es" />
/// <reference file="string_decoder.d.es" />
/// <reference file="test.d.es" />
/// <reference file="timers.d.es" />
/// <reference file="timers/promises.d.es" />
/// <reference file="tls.d.es" />
/// <reference file="trace_events.d.es" />
/// <reference file="tty.d.es" />
/// <reference file="url.d.es" />
/// <reference file="util.d.es" />
/// <reference file="v8.d.es" />
/// <reference file="vm.d.es" />
/// <reference file="wasi.d.es" />
/// <reference file="worker_threads.d.es" />
/// <reference file="zlib.d.es" />
