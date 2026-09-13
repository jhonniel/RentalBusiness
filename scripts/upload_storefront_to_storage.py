#!/usr/bin/env python3
"""Upload storefront product photos to the public product-images bucket."""

from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[1]
STOREFRONT = ROOT / 'public' / 'storefront'


def env_value(name: str) -> str:
    for line in (ROOT / '.env').read_text().splitlines():
        if line.startswith(f'{name}='):
            return line.split('=', 1)[1].strip()
    return ''


UPLOADS = [
    {
        'slug': 'starlink-mini',
        'uuid': '2eba12bb-40d0-4427-90c7-a2756c65d719',
        'file': STOREFRONT / 'starlink.png',
        'object': '2eba12bb-40d0-4427-90c7-a2756c65d719/starlink.png',
        'alt': 'Starlink Mini',
        'type': 'image/png',
    },
    {
        'slug': 'dji-air-3',
        'uuid': 'c44c581f-0448-4edf-96a1-1d91b42751e5',
        'file': STOREFRONT / 'drone.png',
        'object': 'c44c581f-0448-4edf-96a1-1d91b42751e5/drone.png',
        'alt': 'DJI Air 3',
        'type': 'image/png',
    },
    {
        'slug': 'sony-a7-iv',
        'uuid': 'f4373fde-80b0-4d3a-96f8-f6ce64bab240',
        'file': STOREFRONT / 'action-camera.png',
        'object': 'f4373fde-80b0-4d3a-96f8-f6ce64bab240/camera.png',
        'alt': '360 camera',
        'type': 'image/png',
    },
]


def run_sql(sql: str) -> None:
    result = subprocess.run(
        [
            'psql',
            '-h', 'aws-0-ap-northeast-2.pooler.supabase.com',
            '-p', '5432',
            '-U', 'postgres.msmlarhbkhtkuripjpvl',
            '-d', 'postgres',
            '-v', 'ON_ERROR_STOP=1',
            '-c', sql,
        ],
        check=False,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        sys.stderr.write(result.stderr)
        raise SystemExit(result.returncode)
    if result.stdout.strip():
        print(result.stdout.strip())


def main() -> None:
    url = env_value('NUXT_PUBLIC_SUPABASE_URL').rstrip('/')
    key = env_value('NUXT_PUBLIC_SUPABASE_ANON_KEY')
    if not url or not key:
        raise SystemExit('Missing Supabase URL or anon key.')

    names = ', '.join(f"'{item['object']}'" for item in UPLOADS)
    run_sql(f"""
drop policy if exists product_images_one_time_seed on storage.objects;
create policy product_images_one_time_seed
on storage.objects for insert
to anon, authenticated
with check (
  bucket_id = 'product-images'
  and name in ({names})
);
""")

    try:
        for item in UPLOADS:
            data = item['file'].read_bytes()
            request = Request(
                f"{url}/storage/v1/object/product-images/{item['object']}",
                data=data,
                method='POST',
                headers={
                    'Authorization': f'Bearer {key}',
                    'apikey': key,
                    'Content-Type': item['type'],
                    'x-upsert': 'false',
                },
            )
            try:
                with urlopen(request) as response:
                    print(item['slug'], response.status)
            except HTTPError as error:
                body = error.read().decode()
                print(item['slug'], error.code, body)
                raise
    finally:
        run_sql('drop policy if exists product_images_one_time_seed on storage.objects;')

    inserts = '\n'.join(
        f"""
insert into public.product_images (product_id, storage_path, alt, sort_order)
select p.id, '{item['object']}', '{item['alt']}', 0
from public.products p
where p.slug = '{item['slug']}'
  and not exists (
    select 1
    from public.product_images i
    where i.product_id = p.id
      and i.storage_path = '{item['object']}'
  );
"""
        for item in UPLOADS
    )
    run_sql(f"""
{inserts}
select p.slug, i.storage_path
from public.product_images i
join public.products p on p.id = i.product_id
order by p.slug;
""")


if __name__ == '__main__':
    main()
