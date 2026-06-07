PLUGIN_DIR := com.johnhammerlund.discordadminbot.sdPlugin
PLUGIN_ID  := com.johnhammerlund.discordadminbot
DIST_DIR   := dist
ARTIFACT   := $(DIST_DIR)/$(PLUGIN_ID).streamDeckPlugin

.PHONY: build clean

build:
	cd plugin && npm install && npm run build
	mkdir -p $(DIST_DIR)
	cd plugin && zip -r ../$(ARTIFACT) $(PLUGIN_DIR) --exclude "$(PLUGIN_DIR)/logs/*"
	@echo ""
	@echo "Built: $(ARTIFACT)"

clean:
	rm -rf $(DIST_DIR)
