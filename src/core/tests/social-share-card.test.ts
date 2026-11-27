import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSocialShareFilename,
  extractDomainLabel,
  getCardStatusTagKey,
  resolveShareAppUrl,
  SOCIAL_CARD_DIMENSIONS,
  wrapTextToLines,
} from '../domain/services/social-share-card';

describe('social-share-card pure helpers', () => {
  it('defines exact Instagram Post (1080x1080) and Stories (1080x1920) dimensions', () => {
    assert.deepEqual(SOCIAL_CARD_DIMENSIONS.post, { width: 1080, height: 1080 });
    assert.deepEqual(SOCIAL_CARD_DIMENSIONS.story, { width: 1080, height: 1920 });
  });

  it('sanitizes activity titles into clean PNG filenames', () => {
    assert.equal(
      buildSocialShareFilename('Allenamento Mattutino (5km)!', 'post'),
      'cronosheet_allenamento-mattutino-5km_post.png',
    );
    assert.equal(
      buildSocialShareFilename('Caffè senza zucchero', 'story'),
      'cronosheet_caffe-senza-zucchero_story.png',
    );
    assert.equal(buildSocialShareFilename('   ', 'post'), 'cronosheet_activity_post.png');
  });

  it('wraps text cleanly within line width and maxLines bounds', () => {
    const lines = wrapTextToLines(
      'I have been learning Spanish every morning without skipping a single day',
      24,
      2,
    );
    assert.equal(lines.length, 2);
    assert.ok(lines[0].length <= 24);
    assert.ok(lines[1].length <= 24);
    assert.ok(lines[1].endsWith('…'));
  });

  it('always resolves canonical cronosheetapp.ai.studio URL and extracts clean domain labels', () => {
    assert.equal(resolveShareAppUrl(), 'https://cronosheetapp.ai.studio');
    assert.equal(extractDomainLabel('https://cronosheetapp.ai.studio'), 'cronosheetapp.ai.studio');
    assert.equal(extractDomainLabel('https://www.cronosheetapp.ai.studio/app'), 'cronosheetapp.ai.studio');
  });

  it('maps goal scenarios to localized status tag keys', () => {
    assert.equal(getCardStatusTagKey('COMPLETED'), 'social.completedTag');
    assert.equal(getCardStatusTagKey('ONGOING'), 'social.ongoingTag');
    assert.equal(getCardStatusTagKey('FUTURE_START'), 'social.upcomingTag');
    assert.equal(getCardStatusTagKey('END_ONLY'), 'social.upcomingTag');
  });
});
