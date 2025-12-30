#!/usr/bin/env python3
"""
Backfill pipeline_status for existing form submissions.
Run with --dry-run first to preview changes.

Usage:
    AWS_PROFILE=chris-admin python3 scripts/backfill_pipeline_status.py --dry-run
    AWS_PROFILE=chris-admin python3 scripts/backfill_pipeline_status.py --execute
"""

import boto3
import argparse
from datetime import datetime


def backfill_pipeline_status(dry_run: bool = True):
    dynamodb = boto3.client('dynamodb', region_name='us-east-1')
    table_name = 'picasso_form_submissions'

    updated_count = 0
    skipped_count = 0
    error_count = 0

    print(f"{'[DRY RUN] ' if dry_run else ''}Starting backfill for table: {table_name}")
    print("-" * 60)

    # Scan for items without pipeline_status
    paginator = dynamodb.get_paginator('scan')

    for page in paginator.paginate(
        TableName=table_name,
        FilterExpression='attribute_not_exists(pipeline_status)',
        ProjectionExpression='submission_id, tenant_id, submitted_at'
    ):
        for item in page.get('Items', []):
            submission_id = item.get('submission_id', {}).get('S', 'unknown')
            tenant_id = item.get('tenant_id', {}).get('S', 'unknown')
            submitted_at = item.get('submitted_at', {}).get('S', '')

            print(f"{'[DRY RUN] ' if dry_run else ''}Processing: {submission_id}")
            print(f"  Tenant: {tenant_id}")
            print(f"  Submitted: {submitted_at}")

            if not dry_run:
                try:
                    now = datetime.utcnow().isoformat() + 'Z'

                    dynamodb.update_item(
                        TableName=table_name,
                        Key={'submission_id': {'S': submission_id}},
                        UpdateExpression='''
                            SET pipeline_status = :status,
                                tenant_pipeline_key = :tpk,
                                internal_notes = if_not_exists(internal_notes, :empty),
                                updated_at = :now
                        ''',
                        ExpressionAttributeValues={
                            ':status': {'S': 'new'},
                            ':tpk': {'S': f'{tenant_id}#new'},
                            ':empty': {'S': ''},
                            ':now': {'S': now}
                        }
                    )
                    print(f"  ✅ Updated successfully")
                    updated_count += 1
                except Exception as e:
                    print(f"  ❌ ERROR: {e}")
                    error_count += 1
            else:
                print(f"  → Would set pipeline_status='new', tenant_pipeline_key='{tenant_id}#new'")
                updated_count += 1

    # Also check for items that have pipeline_status but missing tenant_pipeline_key
    print("\n" + "-" * 60)
    print("Checking for items with pipeline_status but missing tenant_pipeline_key...")

    for page in paginator.paginate(
        TableName=table_name,
        FilterExpression='attribute_exists(pipeline_status) AND attribute_not_exists(tenant_pipeline_key)',
        ProjectionExpression='submission_id, tenant_id, pipeline_status'
    ):
        for item in page.get('Items', []):
            submission_id = item.get('submission_id', {}).get('S', 'unknown')
            tenant_id = item.get('tenant_id', {}).get('S', 'unknown')
            pipeline_status = item.get('pipeline_status', {}).get('S', 'new')

            print(f"{'[DRY RUN] ' if dry_run else ''}Fixing: {submission_id}")
            print(f"  Status: {pipeline_status}, Tenant: {tenant_id}")

            if not dry_run:
                try:
                    dynamodb.update_item(
                        TableName=table_name,
                        Key={'submission_id': {'S': submission_id}},
                        UpdateExpression='SET tenant_pipeline_key = :tpk',
                        ExpressionAttributeValues={
                            ':tpk': {'S': f'{tenant_id}#{pipeline_status}'}
                        }
                    )
                    print(f"  ✅ Fixed tenant_pipeline_key")
                    updated_count += 1
                except Exception as e:
                    print(f"  ❌ ERROR: {e}")
                    error_count += 1
            else:
                print(f"  → Would set tenant_pipeline_key='{tenant_id}#{pipeline_status}'")
                updated_count += 1

    print("\n" + "=" * 60)
    print(f"{'[DRY RUN] ' if dry_run else ''}SUMMARY:")
    print(f"  {'Would update' if dry_run else 'Updated'}: {updated_count} items")
    if error_count > 0:
        print(f"  Errors: {error_count} items")
    print("=" * 60)


if __name__ == '__main__':
    parser = argparse.ArgumentParser(
        description='Backfill pipeline_status for existing form submissions'
    )
    parser.add_argument(
        '--dry-run',
        action='store_true',
        help='Preview changes without writing to DynamoDB'
    )
    parser.add_argument(
        '--execute',
        action='store_true',
        help='Actually perform the updates'
    )
    args = parser.parse_args()

    if not args.dry_run and not args.execute:
        print("Please specify --dry-run or --execute")
        print("\nUsage:")
        print("  AWS_PROFILE=chris-admin python3 scripts/backfill_pipeline_status.py --dry-run")
        print("  AWS_PROFILE=chris-admin python3 scripts/backfill_pipeline_status.py --execute")
        exit(1)

    backfill_pipeline_status(dry_run=not args.execute)
