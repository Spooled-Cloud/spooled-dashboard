import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(__dirname, '../../..');
const read = (path: string) => readFileSync(resolve(ROOT, path), 'utf8');

describe('.dockerignore', () => {
  it('exists', () => {
    expect(existsSync(resolve(ROOT, '.dockerignore'))).toBe(true);
  });

  const entries = () =>
    read('.dockerignore')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#'));

  it.each(['node_modules', 'dist', '.env*', '.git', 'coverage', 'test-results'])(
    'keeps %s out of the build context',
    (entry) => {
      expect(entries()).toContain(entry);
    }
  );

  it('does not exclude anything the image build needs', () => {
    // The Dockerfile copies package*.json, then the rest of the tree, then runs `npm run build`.
    const needed = [
      'src',
      'public',
      'package.json',
      'package-lock.json',
      'astro.config.mjs',
      'tsconfig.json',
      'tailwind.config.js',
    ];
    for (const entry of entries()) {
      const pattern = entry.replace(/\/$/, '');
      for (const name of needed) {
        expect(pattern === name || pattern === `${name}/`).toBe(false);
      }
      expect(pattern.startsWith('!')).toBe(false);
      expect(pattern).not.toBe('*');
    }
  });
});

describe('src/pages', () => {
  /** Every file under src/pages, as a path relative to it. */
  function pageFiles(dir = resolve(ROOT, 'src/pages'), prefix = ''): string[] {
    return readdirSync(dir, { withFileTypes: true }).flatMap((entry) =>
      entry.isDirectory()
        ? pageFiles(resolve(dir, entry.name), `${prefix}${entry.name}/`)
        : [`${prefix}${entry.name}`]
    );
  }

  it('holds no test or spec file: Astro would build each one as a public route', () => {
    // GET /api/config.test used to answer 500 with a vitest stack trace. Keep tests next to the
    // code under src/lib (or src/test) and import the route module from there.
    const stray = pageFiles().filter((file) => /.(test|spec).[cm]?[jt]sx?$/.test(file));
    expect(stray).toEqual([]);
  });
});

describe('Kubernetes overlays', () => {
  /** Values of `- KEY=value` lines in the overlay's configMapGenerator literals. */
  function literals(overlay: string): Record<string, string> {
    const out: Record<string, string> = {};
    for (const m of read(`k8s/overlays/${overlay}/kustomization.yaml`).matchAll(
      /^\s*-\s+([A-Z_]+)=(.*)$/gm
    )) {
      out[m[1]] = m[2].trim();
    }
    return out;
  }

  it.each(['development', 'production'])(
    'the %s overlay hands the browser URLs it can resolve, not in-cluster DNS names',
    (overlay) => {
      const values = literals(overlay);
      expect(values.PUBLIC_API_URL).toBeTruthy();
      expect(values.PUBLIC_WS_URL).toBeTruthy();
      expect(values.PUBLIC_API_URL).not.toMatch(/\.svc(\.cluster\.local)?\b/);
      expect(values.PUBLIC_WS_URL).not.toMatch(/\.svc(\.cluster\.local)?\b/);
    }
  );

  it('the development overlay points the browser at localhost (reached by port-forward)', () => {
    const values = literals('development');
    expect(values.PUBLIC_API_URL).toBe('http://localhost:3000');
    expect(values.PUBLIC_WS_URL).toBe('ws://localhost:3000');
  });
});
