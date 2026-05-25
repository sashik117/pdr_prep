-- Очистка довідника від цифрових хвостів і простих дублів у handbook_data

BEGIN;

UPDATE handbook_data
SET content_text = regexp_replace(
        regexp_replace(
            regexp_replace(content_text, '(?:\m\d{1,2}\M\s*){8,}', ' ', 'g'),
            '\s+(?:(?:\d+\.)+\d+|\d+\.\d+|\d+)\s*$',
            '',
            'g'
        ),
        '\s+([A-Za-zА-Яа-яІіЇїЄєҐґ''’`-]+)\s*$',
        '',
        'g'
    )
WHERE content_text IS NOT NULL;

UPDATE handbook_data
SET content_html = regexp_replace(
        regexp_replace(
            regexp_replace(
                content_html,
                '<(?:p|div)[^>]*>\s*(?:<a[^>]*>\s*\d+\s*</a>\s*){5,}</(?:p|div)>',
                '',
                'gi'
            ),
            '(<(?:p|li|div)[^>]*>.*?)(\s+(?:(?:\d+\.)+\d+|\d+\.\d+|\d+)\s*)(</(?:p|li|div)>)',
            '\1\3',
            'gi'
        ),
        '(<(?:p|li|div)[^>]*>)([^<]{4,}?)(\s+\2\s*)(</(?:p|li|div)>)',
        '\1\2\4',
        'gi'
    )
WHERE content_html IS NOT NULL;

COMMIT;
