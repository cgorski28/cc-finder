import { NextResponse } from "next/server";
import { lookupCompound, processInParallel } from "@/lib/pubchem";
import { LookupRequest, LookupResponse } from "@/lib/types";

const MAX_IDENTIFIERS = 500;

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as LookupRequest;

    if (!body.identifiers || !Array.isArray(body.identifiers)) {
      return NextResponse.json(
        { error: "Request must include an identifiers array" },
        { status: 400 }
      );
    }

    if (body.identifiers.length === 0) {
      return NextResponse.json(
        { error: "Identifiers array must not be empty" },
        { status: 400 }
      );
    }

    if (body.identifiers.length > MAX_IDENTIFIERS) {
      return NextResponse.json(
        { error: `Maximum ${MAX_IDENTIFIERS} identifiers per request` },
        { status: 400 }
      );
    }

    const results = await processInParallel(
      body.identifiers,
      lookupCompound
    );

    const response: LookupResponse = { results };
    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}
