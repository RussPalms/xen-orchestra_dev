import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import * as File from './file.mjs'
import { tmpdir } from 'node:os'


describe('immutable-backups/file', async()=>{

    it('really lock a file', async()=>{
        const dir = await fs.mkdtemp(path.join(tmpdir(),'immutable-backups-tests'))
        const filePath = path.join( dir, 'test')
        await fs.writeFile(filePath, 'data')
        await File.makeImmutable(filePath)
        await assert.rejects(()=>fs.writeFile(filePath, 'data'))
        await assert.rejects(()=>fs.appendFile(filePath, 'data'))
        await assert.rejects(()=>fs.unlink(filePath))
        await assert.rejects(()=>fs.rename(filePath, filePath+'copy'))
        await File.liftImmutability(filePath)
        await fs.writeFile(filePath, 'data')
        await fs.appendFile(filePath, 'data')
        await fs.unlink(filePath)
    })
})