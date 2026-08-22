import fs from "node:fs";
import path from "node:path";

export class JsonStore {
  constructor(file) {
    this.file = file;
    this.batchDepth = 0;
    this.dirty = false;
    this.data = {
      questProgress: {},
      tokenBalances: {},
      lastSnapshots: {}
    };
    this.load();
  }

  load() {
    try {
      if (fs.existsSync(this.file)) {
        this.data = {
          ...this.data,
          ...JSON.parse(fs.readFileSync(this.file, "utf8"))
        };
      }
    } catch (error) {
      console.error("[store] load failed", error);
    }
  }

  save() {
    if (this.batchDepth > 0) {
      this.dirty = true;
      return;
    }

    this.write();
  }

  write() {
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(this.data, null, 2));
    fs.renameSync(tmp, this.file);
    this.dirty = false;
  }

  batch(callback) {
    this.batchDepth += 1;

    try {
      return callback();
    } finally {
      this.batchDepth -= 1;
      if (this.batchDepth === 0 && this.dirty) this.write();
    }
  }
}
