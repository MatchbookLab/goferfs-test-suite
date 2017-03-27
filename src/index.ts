import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';
import * as fs from 'fs';
import * as path from 'path';
import * as Bluebird from 'bluebird';

import { Gofer } from 'goferfs';
import { Visibility, IAdapter } from 'goferfs/types';
import { Readable } from 'stream';

const Magic: any = require('mmmagic').Magic;
const magic: any = Bluebird.promisifyAll(new Magic());

chai.use(chaiAsPromised);
chai.should();

export function goferTests<TAdapter>(adapter: IAdapter<TAdapter>) {
    let prefix: string;
    let gofer: Gofer<TAdapter>;

    before(() => {
        // tests may be run concurrently, so need to prefix files
        prefix = '' + Math.ceil(Math.random() * 100000);
        gofer = new Gofer<TAdapter>(adapter);
    });

    describe('The Basics', () => {
        it('should get adapter name', () => {
            gofer.adapterName.should.exist;
            gofer.adapterName.should.equal(adapter.adapterName);
        });

        it('should write and read', async () => {
            await gofer.write(`${prefix}-test.txt`, 'Hello, friend!');

            (await gofer.exists(`${prefix}-test.txt`)).should.equal(true, 'exists');

            const { contents } = await gofer.read(`${prefix}-test.txt`, { encoding: 'utf8' });
            contents.should.equal('Hello, friend!', 'contents');
        });

        it('should delete', async () => {
            await gofer.delete(`${prefix}-test.txt`);

            (await gofer.exists(`${prefix}-test.txt`)).should.equal(false, 'exists');
        });

        it('should create path to file', async () => {
            await gofer.write(`${prefix}-path/to/test.txt`, 'Test');

            (await gofer.exists(`${prefix}-path/to/test.txt`)).should.equal(true, 'exists');
        });

        it('should delete a directory', async () => {
            await gofer.deleteDir(`${prefix}-path`);

            (await gofer.exists(`${prefix}-path/to/test.txt`)).should.equal(false, 'exists');
        });

        it('should overwrite contents of existing files', async () => {
            await gofer.write(`${prefix}-path/overwrite.txt`, 'Old Contents');
            await gofer.write(`${prefix}-path/overwrite.txt`, 'New Contents');

            const { contents } = await gofer.read(`${prefix}-path/overwrite.txt`, { encoding: 'utf8' });
            contents.should.equal('New Contents', 'contents');
        });
    });

    describe('The Fun', () => {
        afterEach(async () => {
            await gofer.deleteDir(`${prefix}-path`);

            // @TODO maybe update this to do more specific check (not storages don't support directories)
            (await gofer.exists(`${prefix}-path`)).should.equal(false, 'exists');
        });

        it('should move', async () => {
            await gofer.write(`${prefix}-path/to/test1.txt`, 'Test');
            await gofer.move(`${prefix}-path/to/test1.txt`, `${prefix}-path/to/test2.txt`);

            (await gofer.exists(`${prefix}-path/to/test1.txt`)).should.equal(false, '"path/to/test1.txt" exists');
            (await gofer.exists(`${prefix}-path/to/test2.txt`)).should.equal(true, '"path/to/test2.txt" exists');
            (await gofer.read(`${prefix}-path/to/test2.txt`, { encoding: 'utf8' })).contents.should.equal('Test', '"path/to/test2.txt" contents');
        });

        it('should copy', async () => {
            await gofer.write(`${prefix}-path/to/test1.txt`, 'Test');
            await gofer.copy(`${prefix}-path/to/test1.txt`, `${prefix}-path/to/test2.txt`);

            (await gofer.exists(`${prefix}-path/to/test1.txt`)).should.equal(true, '"path/to/test1.txt" exists');
            (await gofer.exists(`${prefix}-path/to/test2.txt`)).should.equal(true, '"path/to/test2.txt" exists');
            (await gofer.read(`${prefix}-path/to/test1.txt`, { encoding: 'utf8' })).contents.should.equal('Test', '"path/to/test1.txt" contents');
            (await gofer.read(`${prefix}-path/to/test2.txt`, { encoding: 'utf8' })).contents.should.equal('Test', '"path/to/test2.txt" contents');
        });

        it('should return full metadata', async () => {
            await gofer.write(`${prefix}-path/to/test1.txt`, 'Test');
            const file = await gofer.read(`${prefix}-path/to/test1.txt`, { encoding: 'utf8' });

            file.contents.should.equal('Test', 'contents');
            file.name.should.equal('test1.txt', 'name');
            file.ext.should.equal('.txt', 'ext');
            file.path.should.equal(`${prefix}-path/to/test1.txt`, 'path');
            file.parentDir.should.equal(`${prefix}-path/to`, 'parentDir');
            file.visibility.should.equal(Visibility.Public, 'visibility');
            file.size.should.equal(4, 'size');
            file.isFile.should.equal(true, 'isFile');
            file.isDir.should.equal(false, 'isDir');
            file.timestamp.should.be.a('Date', 'timestamp');
            file.mimetype.should.equal('text/plain', 'mimetype');
        });

        it('should do streams', async () => {
            const inputStream = new Readable();

            inputStream.push('Test Stream');
            inputStream.push(null);

            await gofer.writeStream(`${prefix}-path/to/test-stream.txt`, inputStream);

            const { stream } = await gofer.readStream(`${prefix}-path/to/test-stream.txt`, { encoding: 'utf8' });

            const contents = await new Promise((resolve, reject) => {
                let str = '';
                stream.on('data', (chunk: string) => str += chunk);
                stream.on('end', () => resolve(str));
                stream.on('error', reject);
            });

            contents.should.equal('Test Stream', 'contents');
        });

        it('should override contents with streams', async () => {
            const inputStreamOld = new Readable();

            inputStreamOld.push('Old Stream Contents');
            inputStreamOld.push(null);

            await gofer.writeStream(`${prefix}-path/overwrite-stream.txt`, inputStreamOld);

            const inputStreamNew = new Readable();

            inputStreamNew.push('New Stream Contents');
            inputStreamNew.push(null);

            await gofer.writeStream(`${prefix}-path/overwrite-stream.txt`, inputStreamNew);

            const { contents } = await gofer.read(`${prefix}-path/overwrite-stream.txt`, { encoding: 'utf8' });
            contents.should.equal('New Stream Contents', 'contents');
        });


        it('should get visibility', async () => {
            await gofer.write(`${prefix}-path/to/test.txt`, 'Test', { visibility: Visibility.Public });

            (await gofer.getVisibility(`${prefix}-path/to/test.txt`)).should.equal(Visibility.Public, 'visibility');
        });

        it('should set visibility', async () => {
            await gofer.write(`${prefix}-path/to/test.txt`, 'Test', { visibility: Visibility.Public });

            await gofer.setVisibility(`${prefix}-path/to/test.txt`, Visibility.Private);
            (await gofer.getVisibility(`${prefix}-path/to/test.txt`)).should.equal(Visibility.Private, 'visibility');
        });

        it('should throw if an invalid visibility is provided', () => {
            return gofer.setVisibility(`${prefix}-path/to/test.txt`, 13 as Visibility).should.eventually.be.rejectedWith('Unsupported Visibility: 13');
        });
    });

    describe('The Encoding', () => {
        const message = 'This is a base64 encoded message';
        const base64Message: string = 'VGhpcyBpcyBhIGJhc2U2NCBlbmNvZGVkIG1lc3NhZ2U=';

        afterEach(async () => {
            await gofer.deleteDir(`${prefix}-path`);

            // @TODO maybe update this to do more specific check (not storages don't support directories)
            (await gofer.exists(`${prefix}-path`)).should.equal(false, 'exists');
        });

        it('should handle non-utf8 encoding', async () => {
            await gofer.write(`${prefix}-path/to/test.txt`, base64Message, { encoding: 'base64' });

            const { contents: base64 } = await gofer.read(`${prefix}-path/to/test.txt`, { encoding: 'base64' });
            base64.should.equal(base64Message, 'base64 string mismatch');

            const { contents: utf8 } = await gofer.read(`${prefix}-path/to/test.txt`, { encoding: 'utf8' });
            utf8.should.equal(message, 'utf8 string mismatch');
        });

        it('should handle non-utf8 encoding with streams', async () => {
            await gofer.write(`${prefix}-path/to/test-stream-base64.txt`, base64Message, { encoding: 'base64' });

            const { stream: base64Stream } = await gofer.readStream(`${prefix}-path/to/test-stream-base64.txt`, { encoding: 'base64' });
            const base64 = await new Promise((resolve, reject) => {
                let str = '';
                base64Stream.on('data', (chunk: string) => str += chunk);
                base64Stream.on('end', () => resolve(str));
                base64Stream.on('error', reject);
            });

            // base64.should.equal(base64Message, 'base64 string mismatch');

            const { stream: utf8Stream } = await gofer.readStream(`${prefix}-path/to/test-stream-base64.txt`, { encoding: 'utf8' });
            const utf8 = await new Promise((resolve, reject) => {
                let str = '';
                utf8Stream.on('data', (chunk: string) => str += chunk);
                utf8Stream.on('end', () => resolve(str));
                utf8Stream.on('error', reject);
            });

            utf8.should.equal(message, 'utf8 string mismatch');
        });


        it('should handle buffers as input', async () => {
            const buffer = new Buffer(message, 'utf8');

            await gofer.write(`${prefix}-path/to/test.txt`, buffer);

            const { contents } = await gofer.read(`${prefix}-path/to/test.txt`, { encoding: 'utf8' });

            contents.should.equal(message);
        });

        it('should handle buffers as input (2)', async () => {
            const buffer = new Buffer(base64Message, 'base64');

            await gofer.write(`${prefix}-path/to/test.txt`, buffer);

            const { contents } = await gofer.read(`${prefix}-path/to/test.txt`, { encoding: 'utf8' });

            contents.should.equal(message);
        });

        it('should handle ignoring encoding for buffers', async () => {
            const buffer = new Buffer(base64Message, 'base64');

            await gofer.write(`${prefix}-path/to/test.txt`, buffer, { encoding: 'latin1' });

            const { contents } = await gofer.read(`${prefix}-path/to/test.txt`, { encoding: 'utf8' });

            contents.should.equal(message);
        });

        it('should handle buffers as output', async () => {
            await gofer.write(`${prefix}-path/to/test.txt`, message, { encoding: 'utf8' });

            const { contents } = await gofer.read(`${prefix}-path/to/test.txt`);

            contents.should.be.instanceof(Buffer);
            (await magic.detectAsync(contents)).should.equal('ASCII text, with no line terminators');
        });
    });
}
