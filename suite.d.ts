import { IAdapter } from 'goferfs/types/interfaces';

declare module 'goferfs-test-suite' {
    export function goferTests(adapter: IAdapter): void;
}
