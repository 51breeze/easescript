/// <reference file="../node-typings/index.d.es" />

package;

import * as assert from 'node:assert';
import {AssertionError} from 'node:assert';
import {AsyncResource} from 'node:async_hooks';
import * as posix from 'node:path/posix';
import {Certificate} from 'node:crypto';

class TestNodeJsImport{

    assert(){
        assert(0, new AssertionError({message:"is false"}));
    }

    async_hooks(){
        async_hooks.createHook({});
        new AsyncResource('demo') 
    }

    buffer(){
        Buffer.alloc(10);
        Buffer.alloc(10, 1);
        Buffer.from('tést', 'latin1');
        buffer.constants.MAX_LENGTH
    }

    async child_process(){
        const execFile = util.promisify( child_process.execFile );
        const version = await execFile('node', ['--version']); 
    }

    path(){
        path.basename('aa/bb.cc', '.cc')
        path.posix.basename('aa/bb.cc', '.cc')
        posix.basename('aa/bb.cc', '.cc')
    }

    fs(){
        fs.existsSync(path.join(__dirname, 'Test.js'))
        fs.constants.R_OK
    }

    net(){
        
        const blockList = new net.BlockList();
        blockList.addAddress('123.123.123.123');
        blockList.addRange('10.0.0.1', '10.0.0.10');
        blockList.addSubnet('8592:757c:efae:4e45::', 64, 'ipv6');
        blockList.check('123.123.123.123')
        
    }

    crypto(){
        const cert = Certificate();
        const cert2 = new crypto.Certificate();
        const secret = 'abcdefg';
        const hash = crypto.createHmac('sha256', secret)
                    .update('I love cupcakes')
                    .digest('hex');  
        
    }

    http(){
        const proxy = http.createServer((req, res) => {
            res.writeHead(200, { 'Content-Type': 'text/plain' });
            res.end('okay');
        });
        proxy.on('connect', (req, clientSocket, head) => {
            const { port, hostname } = new URL(`http://${req.url}`);
            const serverSocket = net.connect((port as number) || 80, hostname, () => {
                clientSocket.write('HTTP/1.1 200 Connection Established\r\n' +
                                'Proxy-agent: Node.js-Proxy\r\n' +
                                '\r\n');
                serverSocket.write(head);
                serverSocket.pipe(clientSocket);
                clientSocket.pipe(serverSocket);
            });
        });
    }

}