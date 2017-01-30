import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import Gofer from 'goferfs';
import { Visibility } from 'goferfs/types';
import { IAdapter } from 'goferfs/types/interfaces';
import { Readable } from 'stream';

chai.use(chaiAsPromised);
chai.should();

export function goferTests(adapter: IAdapter) {
    const gofer = new Gofer(adapter);

    describe('The Basics', function () {
        it('should write and read', async () => {
            await gofer.write('test.txt', 'Hello, friend!');

            (await gofer.exists('test.txt')).should.equal(true, 'exists');

            const { contents } = await gofer.read('test.txt');
            contents.should.equal('Hello, friend!', 'contents');
        });

        it('should delete', async () => {
            await gofer.delete('test.txt');

            (await gofer.exists('test.txt')).should.equal(false, 'exists');
        });

        it('should create path to file', async () => {
            await gofer.write('path/to/test.txt', 'Test');

            (await gofer.exists('path/to/test.txt')).should.equal(true, 'exists');
        });

        it('should delete a directory', async () => {
            await gofer.deleteDir('path');

            (await gofer.exists('path/to/test.txt')).should.equal(false, 'exists');
        });
    });

    describe('The Fun', function () {
        afterEach(async () => {
            await gofer.deleteDir('/');

            (await gofer.exists('path')).should.equal(false, 'exists');
        });

        it('should move', async () => {
            await gofer.write('path/to/test1.txt', 'Test');
            await gofer.move('path/to/test1.txt', 'path/to/test2.txt');

            (await gofer.exists('path/to/test1.txt')).should.equal(false, '"path/to/test1.txt" exists');
            (await gofer.exists('path/to/test2.txt')).should.equal(true, '"path/to/test2.txt" exists');
            (await gofer.read('path/to/test2.txt')).contents.should.equal('Test', '"path/to/test2.txt" contents');
        });

        it('should copy', async () => {
            await gofer.write('path/to/test1.txt', 'Test');
            await gofer.copy('path/to/test1.txt', 'path/to/test2.txt');

            (await gofer.exists('path/to/test1.txt')).should.equal(true, '"path/to/test1.txt" exists');
            (await gofer.exists('path/to/test2.txt')).should.equal(true, '"path/to/test2.txt" exists');
            (await gofer.read('path/to/test1.txt')).contents.should.equal('Test', '"path/to/test1.txt" contents');
            (await gofer.read('path/to/test2.txt')).contents.should.equal('Test', '"path/to/test2.txt" contents');
        });

        it('should return full metadata', async () => {
            await gofer.write('path/to/test1.txt', 'Test');
            const file = await gofer.read('path/to/test1.txt');

            file.contents.should.equal('Test', 'contents');
            file.name.should.equal('test1.txt', 'name');
            file.ext.should.equal('.txt', 'ext');
            file.path.should.equal('path/to/test1.txt', 'path');
            file.parentDir.should.equal('path/to', 'parentDir');
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

            await gofer.writeStream('path/to/test1.txt', inputStream);

            const { stream } = await gofer.readStream('path/to/test1.txt');

            const contents = await new Promise((resolve, reject) => {
                let str = '';
                stream.on('data', (chunk: string) => str += chunk);
                stream.on('end', () => resolve(str));
                stream.on('error', reject);
            });

            contents.should.equal('Test Stream', 'contents');
        });

        it('should get visibility', async () => {
            await gofer.write('path/to/test.txt', 'Test', { visibility: Visibility.Public });

            (await gofer.getVisibility('path/to/test.txt')).should.equal(Visibility.Public, 'visibility');
        });

        it('should set visibility', async () => {
            await gofer.write('path/to/test.txt', 'Test', { visibility: Visibility.Public });

            await gofer.setVisibility('path/to/test.txt', Visibility.Private);
            (await gofer.getVisibility('path/to/test.txt')).should.equal(Visibility.Private, 'visibility');
        });
    });
}
