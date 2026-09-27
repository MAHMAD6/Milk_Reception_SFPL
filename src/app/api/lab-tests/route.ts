import { NextResponse } from 'next/server';
import { prisma } from '@core/db';
import { requireAuthenticated } from '@core/apiGuard';

function serializeLabTest(test: any) {
  return {
    id: test.id.toString(),
    testCode: test.testCode,
    testName: test.testName,
    resultType: test.resultType,
    unit: test.unit,
    testScope: test.testScope,
    isRequired: test.isRequired,
    displayOrder: test.displayOrder,
    resultOptions: test.resultOptions || null,
  };
}

export async function GET(req: Request) {
  const access = await requireAuthenticated(req);
  if (!access.ok) return access.response;

  const { searchParams } = new URL(req.url);
  const scopeParam = searchParams.get('scope');
  const scope = (scopeParam || 'DISPATCH').trim().toUpperCase();

  if (!['DISPATCH', 'PLANT', 'ZMCC'].includes(scope)) {
    return NextResponse.json(
      { error: `Invalid scope: "${scopeParam}". Supported scopes are: DISPATCH, PLANT, ZMCC.` },
      {
        status: 400,
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
        },
      }
    );
  }

  try {
    const scopeFilter =
      scope === 'DISPATCH'
        ? { in: ['DISPATCH', 'BOTH', 'ALL'] }
        : scope === 'PLANT'
        ? { in: ['PLANT', 'BOTH', 'ALL'] }
        : { in: ['ZMCC', 'ALL'] };

    const tests = await prisma.labTest.findMany({
      where: {
        isActive: true,
        testScope: scopeFilter,
      },
      orderBy: [
        { displayOrder: 'asc' },
        { testName: 'asc' },
      ],
    });

    return NextResponse.json(
      { tests: tests.map(serializeLabTest) },
      {
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
        },
      }
    );
  } catch (error: unknown) {
    console.error('[API_LAB_TESTS_GET_ERROR]', error);
    return NextResponse.json(
      { error: 'Failed to fetch lab tests' },
      {
        status: 500,
        headers: {
          'Cache-Control': 'private, no-store, max-age=0',
        },
      }
    );
  }
}
