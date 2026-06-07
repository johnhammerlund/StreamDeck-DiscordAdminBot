PLUGIN_DIR := com.johnhammerlund.discordadminbot.sdPlugin
PLUGIN_ID  := com.johnhammerlund.discordadminbot
DIST_DIR   := dist
ARTIFACT   := $(DIST_DIR)/$(PLUGIN_ID).streamDeckPlugin
ZIP        := $(DIST_DIR)/$(PLUGIN_ID).zip

.PHONY: build clean

build:
	cd plugin && npm install && npm run build
	mkdir -p $(DIST_DIR)
	cd plugin && zip -r ../$(ARTIFACT) $(PLUGIN_DIR) --exclude "$(PLUGIN_DIR)/logs/*"
	cp $(ARTIFACT) $(ZIP)
	@echo ""
	@echo "Built:"
	@echo "  $(ARTIFACT)  ← double-click to install"
	@echo "  $(ZIP)       ← upload to GitHub Release"

clean:
	rm -rf $(DIST_DIR)
