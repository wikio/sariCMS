import { ValidationPipe } from '@nestjs/common';
import { CreateMenuDto } from './menu.dto';

describe('News submenu grouping', () => {
  const pipe = new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true });
  const save = (groupBy?: string) => pipe.transform({
    name: 'Principal', location: 'main', items: [{
      label: 'Actualités', href: '/news', auto: { source: 'news', mode: 'groups', groupBy, ids: ['Innovation'] },
    }],
  }, { type: 'body', metatype: CreateMenuDto });

  it.each([undefined, 'category', 'tag', 'type'])('retains a validated rule (%s)', async (groupBy) => {
    const menu: CreateMenuDto = await save(groupBy);
    expect(menu.items[0].auto?.groupBy).toBe(groupBy);
    expect(menu.items[0].auto?.ids).toEqual(['Innovation']);
  });

  it('rejects unknown grouping keys', async () => {
    await expect(save('author')).rejects.toThrow();
  });
});
