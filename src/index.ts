import * as chai from 'chai';
import * as chaiAsPromised from 'chai-as-promised';

import Gofer from 'goferfs';
import { IAdapter } from 'goferfs/types/interfaces';
import { Visibility } from 'goferfs/types';
import { Readable } from 'stream';

chai.use(chaiAsPromised);
chai.should();

export default function(adapter: IAdapter) {
    const gofer = new Gofer(adapter);

    describe('The Basics', function () {
        it('should write and read', async () => {
            await gofer.write('test.txt', 'Hello, friend!');

            (await gofer.exists('test.txt')).should.equal(true);

            const { contents } = await gofer.read('test.txt');
            contents.should.equal('Hello, friend!');
        });

        it('should delete', async () => {
            await gofer.delete('test.txt');

            (await gofer.exists('test.txt')).should.equal(false);
        });

        it('should create path to file', async () => {
            await gofer.write('path/to/test.txt', 'Test');

            (await gofer.exists('path/to/test.txt')).should.equal(true);
        });

        it('should delete a directory', async () => {
            await gofer.deleteDir('path');

            (await gofer.exists('path/to/test.txt')).should.equal(false);
        });
    });

    describe('The Fun', function () {
        afterEach(async () => {
            await gofer.deleteDir('/');

            (await gofer.exists('path')).should.equal(false);
        });

        it('should rename', async () => {
            await gofer.write('path/to/test1.txt', 'Test');
            await gofer.move('path/to/test1.txt', 'path/to/test2.txt');

            (await gofer.exists('path/to/test1.txt')).should.equal(false);
            (await gofer.exists('path/to/test2.txt')).should.equal(true);
            (await gofer.read('path/to/test2.txt')).contents.should.equal('Test');
        });

        it('should copy', async () => {
            await gofer.write('path/to/test1.txt', 'Test');
            await gofer.copy('path/to/test1.txt', 'path/to/test2.txt');

            (await gofer.exists('path/to/test1.txt')).should.equal(true);
            (await gofer.exists('path/to/test2.txt')).should.equal(true);
            (await gofer.read('path/to/test1.txt')).contents.should.equal('Test');
            (await gofer.read('path/to/test2.txt')).contents.should.equal('Test');
        });

        it('should return full metadata', async () => {
            await gofer.write('path/to/test1.txt', 'Test');
            const file = await gofer.read('path/to/test1.txt');

            file.contents.should.equal('Test');
            file.name.should.equal('test1.txt');
            file.ext.should.equal('.txt');
            file.path.should.equal('path/to/test1.txt');
            file.parentDir.should.equal('path/to');
            file.visibility.should.equal(Visibility.Public);
            file.size.should.equal(4);
            file.isFile.should.equal(true);
            file.isDir.should.equal(false);
            file.timestamp.should.be.a('Date');
            file.mimetype.should.equal('text/plain');
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

            contents.should.equal('Test Stream');
        });

        it('should get visibility', async () => {
            await gofer.write('path/to/test.txt', 'Test');

            (await gofer.getVisibility('path/to/test.txt')).should.equal(Visibility.Public);
        });

        it('should get visibility', async () => {
            await gofer.write('path/to/test.txt', 'Test');

            await gofer.setVisibility('path/to/test.txt', Visibility.Private);
            (await gofer.getVisibility('path/to/test.txt')).should.equal(Visibility.Private);
        });
    });
}
