import {createHash} from 'node:crypto';
import {readFile, readdir, stat} from 'node:fs/promises';
import {isAbsolute, join, relative, sep} from 'node:path';
import {parse} from 'yaml';

export const snapshotPath = 'content/records.json';
const dateFormat = new Intl.DateTimeFormat('sv-SE', {timeZone: 'Asia/Seoul', dateStyle: 'short'});
const text = value => typeof value === 'string' ? value.trim() : '';

export async function configuredFolder() {
  const source = await readFile('records.local.json', 'utf8').catch(error => {
    if (error.code === 'ENOENT') throw new Error('records.local.json에 옵시디언 폴더 경로를 설정해 주세요.');
    throw error;
  });
  const {folder} = JSON.parse(source.replace(/^\uFEFF/, ''));
  if (typeof folder !== 'string' || !isAbsolute(folder)) {
    throw new Error('records.local.json의 folder에는 절대 경로를 입력해 주세요.');
  }
  return folder;
}

export async function readRecords(folder) {
  const records = [];

  async function visit(directory) {
    for (const entry of await readdir(directory, {withFileTypes: true})) {
      if (entry.name.startsWith('.') || entry.isSymbolicLink()) continue;
      const file = join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(file);
        continue;
      }
      if (!entry.isFile() || !/\.md$/i.test(entry.name)) continue;

      const source = (await readFile(file, 'utf8')).replace(/^\uFEFF/, '').replaceAll('\r\n', '\n');
      const frontmatter = source.match(/^---[ \t]*\n([\s\S]*?)^---[ \t]*(?:\n|$)/m);
      if (frontmatter?.index !== 0) continue;
      const notePath = relative(folder, file).split(sep).join('/');
      let properties;
      try {
        properties = parse(frontmatter[1], {maxAliasCount: 0});
      } catch (error) {
        throw new Error(`${notePath}: 속성을 읽을 수 없습니다. ${error.message}`);
      }
      if (properties?.publish !== true) continue;

      const date = properties.date ?? dateFormat.format((await stat(file)).birthtime);
      if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
          new Date(date).toJSON()?.slice(0, 10) !== date) {
        throw new Error(`${notePath}: date 속성은 YYYY-MM-DD 형식이어야 합니다.`);
      }
      const tags = Array.isArray(properties.tags) ? properties.tags : text(properties.tags).split(',');
      records.push({
        slug: createHash('sha256').update(notePath).digest('hex').slice(0, 24),
        title: text(properties.title) || entry.name.slice(0, -3),
        date,
        category: text(properties.category) || '기록',
        tags: [...new Set(tags.map(text).filter(Boolean))],
        description: text(properties.description),
        body: source.slice(frontmatter[0].length).replace(/%%[\s\S]*?(?:%%|$)/g, '').trim(),
      });
    }
  }

  await visit(folder);
  return records.sort((a, b) => a.slug.localeCompare(b.slug));
}
