import { NextRequest, NextResponse } from 'next/server';
import { analyzeWebsite } from '@/lib/qa-engine';
import type { WebsiteFile } from '@/lib/qa-engine';
import { runValidationPipeline, mergeValidationIntoResult } from '@/lib/engine';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const files: WebsiteFile[] = [];

    for (const [_, file] of Array.from(formData.entries())) {
      if (file instanceof File) {
        const name = file.name.toLowerCase();
        let type: WebsiteFile['type'] = 'html';
        if (name.endsWith('.css')) type = 'css';
        else if (name.endsWith('.js')) type = 'js';
        else if (name.endsWith('.html') || name.endsWith('.htm')) type = 'html';

        const content = await file.text();
        files.push({ name: file.name, content, type });
      }
    }

    if (files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 });
    }

    const htmlFiles = files.filter(f => f.type === 'html');
    if (htmlFiles.length === 0) {
      return NextResponse.json({
        error: 'No HTML files found. Please include .html or .htm files.',
      }, { status: 400 });
    }

    const { result } = await analyzeWebsite(files, { check404: false });
    const { issues: validatedIssues, risk } = runValidationPipeline(result.issues);
    const validatedResult = mergeValidationIntoResult(result, validatedIssues, risk, true);
    return NextResponse.json(validatedResult);
  } catch (err) {
    console.error(err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Analysis failed' },
      { status: 500 }
    );
  }
}
