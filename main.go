package main

import (
	"embed"

	"eldamo-app/internal/app"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/menu"
	"github.com/wailsapp/wails/v2/pkg/menu/keys"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
	"github.com/wailsapp/wails/v2/pkg/options/mac"
)

//go:embed all:frontend/dist
var assets embed.FS

func main() {
	application := app.NewApp()

	appMenu := menu.NewMenu()
	subAppMenu := appMenu.AddSubmenu("Eldamo")
	subAppMenu.AddText("About Eldamo", nil, func(_ *menu.CallbackData) {
		application.NotifyOpenAbout()
	})
	subAppMenu.AddSeparator()
	subAppMenu.AddText("Preferences…", keys.CmdOrCtrl(","), func(_ *menu.CallbackData) {
		application.NotifyOpenConfig()
	})
	subAppMenu.AddSeparator()
	subAppMenu.AddText("Quit Eldamo", keys.CmdOrCtrl("q"), func(_ *menu.CallbackData) {
		application.Quit()
	})

	appMenu.Append(menu.EditMenu())
	appMenu.Append(menu.WindowMenu())

	err := wails.Run(&options.App{
		Title:  "Eldamo - Elvish Lexicon",
		Width:  1200,
		Height: 800,
		Menu:   appMenu,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		BackgroundColour: &options.RGBA{R: 24, G: 24, B: 27, A: 255},
		OnStartup:        application.Startup,
		OnShutdown:       application.Shutdown,
		Bind: []interface{}{
			application,
		},
		Mac: &mac.Options{
			TitleBar:             mac.TitleBarDefault(),
			WebviewIsTransparent: false,
			WindowIsTranslucent:  false,
		},
	})

	if err != nil {
		println("Error:", err.Error())
	}
}
