"use strict";

class GuideVersionsService {
  constructor(repository) { this.repository = repository; }
  list(guideId) { return this.repository.versions(guideId); }
}

module.exports = { GuideVersionsService };
