import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/../auth';
import { z } from 'zod';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ message: 'Unauthorized - No session' }, { status: 401 });
    }

    // Enforce content-type
    const contentType = req.headers.get('content-type') || '';
    if (!contentType.includes('multipart/form-data')) {
      return NextResponse.json({ message: 'Invalid content type. Use multipart/form-data.' }, { status: 400 });
    }

    const form = await req.formData();
    const midiFile = form.get('midi');
    const jsonData = form.get('json_data') as string;
    
    // Check if we have either MIDI file or JSON data
    if (!midiFile && !jsonData) {
      return NextResponse.json({ message: 'Missing midi file or json_data' }, { status: 400 });
    }

    // Optional hints - only validate these when we have a MIDI file
    const quantize = (form.get('quantize') as string) || '';
    const keyHint = (form.get('key') as string) || '';
    const timeSig = (form.get('timeSignature') as string) || '';
    const bpm = (form.get('bpm') as string) || '';
    const title = (form.get('title') as string) || '';

    // Only validate form metadata if we're uploading a MIDI file
    if (midiFile) {
      const metaSchema = z.object({
        quantize: z.string().max(16).optional().or(z.literal('')),
        key: z.string().max(24).optional().or(z.literal('')),
        timeSignature: z
          .string()
          .max(16)
          .optional()
          .or(z.literal('')),
        bpm: z
          .string()
          .max(8)
          .optional()
          .or(z.literal('')),
        title: z.string().max(100).optional().or(z.literal('')),
      });

      console.log('[Notation Convert] MIDI metadata values:', { quantize, keyHint, timeSig, bpm, title });

      const metaParse = metaSchema.safeParse({ quantize, key: keyHint, timeSignature: timeSig, bpm, title });
      if (!metaParse.success) {
        console.log('[Notation Convert] MIDI metadata validation failed:', metaParse.error.flatten());
        return NextResponse.json({ message: 'Invalid metadata', issues: metaParse.error.flatten() }, { status: 400 });
      }
    }

    // Proxy to external Music21 Notation Service
    const notationServiceUrl = (process.env.NOTATION_SERVICE_URL || '').trim();
    if (!notationServiceUrl) {
      return NextResponse.json({ message: 'NOTATION_SERVICE_URL not configured' }, { status: 500 });
    }

    console.log('[Notation Convert] Using external service:', notationServiceUrl);
    const forward = new FormData();
    
    // Forward either MIDI file or JSON data
    if (midiFile && typeof midiFile !== 'string') {
      const f = midiFile as File;
      const allowedTypes = new Set(['audio/midi', 'audio/x-midi', 'application/x-midi', 'application/octet-stream']);
      const maxBytes = 10 * 1024 * 1024; // 10MB
      const name = (f as any).name || 'upload.mid';
      const hasMidExt = /\.midi?$/.test(name.toLowerCase());
      if (!allowedTypes.has(f.type) && !hasMidExt) {
        return NextResponse.json({ message: 'Invalid file type' }, { status: 400 });
      }
      if (f.size > maxBytes) {
        return NextResponse.json({ message: 'File too large (max 10MB)' }, { status: 413 });
      }
      forward.append('midi', f);
    } else if (jsonData) {
      // Validate JSON body with Zod before forwarding
      const noteSchema = z.object({
        time: z.number().finite().nonnegative(),
        duration: z.number().finite().positive().max(60),
        velocity: z.number().min(0).max(1),
        midi: z.number().int().min(0).max(127),
        isLeftHand: z.boolean().optional(),
      });
      const jsonSchema = z.object({
        bpm: z.number().min(20).max(300).optional(),
        timeSignature: z
          .object({ numerator: z.number().int().min(1).max(12), denominator: z.number().int().min(1).max(16) })
          .optional(),
        title: z.string().max(100).optional(),
        notes: z.array(noteSchema).max(20000),
      });

      let data: unknown;
      try {
        data = JSON.parse(jsonData);
      } catch {
        return NextResponse.json({ message: 'json_data must be valid JSON' }, { status: 400 });
      }
      const check = jsonSchema.safeParse(data);
      if (!check.success) {
        return NextResponse.json({ message: 'Invalid json_data', issues: check.error.flatten() }, { status: 400 });
      }
      forward.append('json_data', JSON.stringify(check.data));
    }
    
    if (bpm) forward.append('bpm', bpm);
    if (timeSig) forward.append('timeSignature', timeSig);
    if (keyHint) forward.append('key', keyHint);
    if (quantize) forward.append('quantize', quantize);
    if (title) forward.append('title', title);

    const target = notationServiceUrl.replace(/\/$/, '') + '/convert';
    const headers: Record<string, string> = {};
    const sharedSecret = (process.env.NOTATION_SHARED_SECRET || '').trim();
    if (sharedSecret) headers['X-Notation-Secret'] = sharedSecret;
    const requestId = req.headers.get('x-request-id') || randomUUID();
    headers['X-Request-Id'] = requestId;
    
    const proxied = await fetch(target, { method: 'POST', body: forward, headers });
    if (!proxied.ok) {
      const errText = await proxied.text().catch(() => '');
      return NextResponse.json({ message: 'Upstream conversion failed', details: errText || proxied.statusText, requestId }, { status: 502 });
    }
    
    const xml = await proxied.text();
    return new NextResponse(xml, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.recordare.musicxml+xml; charset=utf-8',
        'Cache-Control': 'no-store',
        'X-Request-Id': requestId,
      },
    });
  } catch (error) {
    console.error('Error in /api/notation/convert:', error);
    return NextResponse.json({ message: error instanceof Error ? error.message : 'Unknown error' }, { status: 500 });
  }
}


