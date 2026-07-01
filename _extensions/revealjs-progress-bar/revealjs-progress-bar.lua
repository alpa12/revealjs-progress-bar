local function stringify(value)
  if value == nil then
    return nil
  end
  return pandoc.utils.stringify(value)
end

local function boolify(value)
  if value == true or value == false then
    return value
  end
  if type(value) == "table" and value.t == "MetaBool" then
    return value
  end
  local text = stringify(value)
  if text == "true" then
    return true
  end
  if text == "false" then
    return false
  end
  return nil
end

local function js_string(value)
  value = value or ""
  value = value:gsub("\\", "\\\\")
  value = value:gsub('"', '\\"')
  value = value:gsub("\n", "\\n")
  value = value:gsub("\r", "\\r")
  return '"' .. value .. '"'
end

local function script_dir()
  local source = debug.getinfo(1, "S").source
  if source:sub(1, 1) == "@" then
    source = source:sub(2)
  end
  return source:match("^(.*[/\\])") or ""
end

local function read_file(path)
  local file = io.open(path, "r")
  if file == nil then
    error("Unable to read revealjs-progress-bar asset: " .. path)
  end
  local contents = file:read("*a")
  file:close()
  return contents
end

local function get_progress_bar_config(meta)
  if meta["progress-bar"] ~= nil then
    return meta["progress-bar"]
  end
  if meta.progressBar ~= nil then
    return meta.progressBar
  end

  local format = meta.format
  if format and format.revealjs then
    return format.revealjs["progress-bar"] or format.revealjs.progressBar
  end

  return nil
end

function Meta(meta)
  if quarto.doc.is_format and not quarto.doc.is_format("revealjs") then
    return nil
  end

  local config = get_progress_bar_config(meta) or {}
  local overview = boolify(config.overview)
  local animate_overview_exit = boolify(config.animateOverviewExit or config["animate-overview-exit"])
  local section_widths = stringify(config.sectionWidths or config["section-widths"])

  local fields = {}
  if overview ~= nil then
    table.insert(fields, '"overview": ' .. tostring(overview))
  end
  if animate_overview_exit ~= nil then
    table.insert(fields, '"animateOverviewExit": ' .. tostring(animate_overview_exit))
  end
  if section_widths ~= nil then
    table.insert(fields, '"sectionWidths": ' .. js_string(section_widths))
  end

  local dir = script_dir()
  local css = read_file(dir .. "revealjs-progress-bar.css")
  local js = read_file(dir .. "revealjs-progress-bar.js")

  quarto.doc.include_text("in-header", '<style id="rpb-style">' .. css .. "</style>")
  quarto.doc.include_text(
    "in-header",
    '<script>window.RevealProgressBarOptions = {' .. table.concat(fields, ", ") .. "};</script>"
  )
  quarto.doc.include_text("after-body", '<script id="rpb-script">' .. js .. "</script>")

  return nil
end
