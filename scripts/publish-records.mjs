import {execFileSync} from 'node:child_process';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {configuredFolder, readRecords, snapshotPath} from './records.mjs';

async function publish() {
  const folder = await configuredFolder();
  const {branch} = JSON.parse(await readFile('site.json', 'utf8'));
  const records = await readRecords(folder);
  const snapshot = JSON.stringify(records, null, 2) + '\n';
  const temporary = await mkdtemp(join(tmpdir(), 'sonamu-records-'));
  // Use a separate Git index so staged changes and local branches are untouched.
  const env = {...process.env, GIT_INDEX_FILE: join(temporary, 'index')};
  const git = (args, input) => execFileSync('git', args, {env, input, encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'inherit']}).trim();
  try {
    const tracking = `refs/remotes/origin/${branch}`;
    git(['fetch', '--no-write-fetch-head', 'origin', `refs/heads/${branch}:${tracking}`]);
    const head = git(['rev-parse', tracking]);
    if (!git(['ls-tree', head, '--', 'scripts/publish-records.mjs'])) {
      throw new Error(`origin/${branch}에 기록 기능을 먼저 반영해 주세요.`);
    }
    const hasSnapshot = git(['ls-tree', head, '--', snapshotPath]);
    const previous = hasSnapshot ? git(['show', `${head}:${snapshotPath}`]) : '[]';
    if (previous === snapshot.trim()) {
      console.log('발행할 변경 사항이 없습니다.');
      return;
    }
    git(['read-tree', head]);
    const blob = git(['hash-object', '-w', '--stdin'], snapshot);
    git(['update-index', '--add', '--cacheinfo', `100644,${blob},${snapshotPath}`]);
    const tree = git(['write-tree']);
    const commit = git(['commit-tree', tree, '-p', head, '-m', 'Publish Obsidian records']);
    git(['push', 'origin', `${commit}:refs/heads/${branch}`]);
    console.log(`기록 ${records.length}개를 GitHub에 반영했습니다. 사이트 배포는 GitHub Actions에서 진행됩니다.`);
  } finally {
    await rm(temporary, {recursive: true, force: true});
  }
}

try {
  await publish();
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
