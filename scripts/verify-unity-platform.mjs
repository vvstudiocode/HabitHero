import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const repositoryRoot = process.cwd();
const tempDirectory = mkdtempSync(path.join(tmpdir(), 'habithero-unity-contract-'));
const executablePath = path.join(tempDirectory, 'platform-contract-smoke.exe');
const sourceFiles = [
  path.join(repositoryRoot, 'unity/HabitHero/Assets/Scripts/Platform/SupabaseClientSettings.cs'),
  path.join(repositoryRoot, 'unity/HabitHero/Assets/Scripts/Platform/AuthCallbackParser.cs'),
  path.join(repositoryRoot, 'unity/HabitHero/Assets/Scripts/Platform/SupabaseRequestBuilder.cs'),
  path.join(repositoryRoot, 'unity/HabitHero/Assets/Scripts/Platform/SupabaseAuthRequestBuilder.cs'),
  path.join(repositoryRoot, 'unity/HabitHero/Assets/Scripts/Platform/SupabaseSession.cs'),
  path.join(repositoryRoot, 'unity/HabitHero/Tests/PlatformContractSmoke.cs'),
];

try {
  execFileSync('mcs', [
    '-target:exe',
    '-out:' + executablePath,
    ...sourceFiles,
  ], { stdio: 'inherit' });

  execFileSync('mono', [executablePath], { stdio: 'inherit' });
} finally {
  rmSync(tempDirectory, { recursive: true, force: true });
}
