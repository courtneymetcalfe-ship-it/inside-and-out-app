import {spawn} from 'node:child_process';

const child=spawn(process.platform==='win32'?'npx.cmd':'npx',['expo','start','--web','--host','lan','--port','4173'],{stdio:'inherit'});
child.on('exit',code=>process.exit(code??0));
process.on('SIGTERM',()=>child.kill('SIGTERM'));
process.on('SIGINT',()=>child.kill('SIGINT'));
