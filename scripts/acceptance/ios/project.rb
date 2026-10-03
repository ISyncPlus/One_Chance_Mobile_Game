require 'xcodeproj'
require 'fileutils'
root = File.expand_path('../../..', __dir__)
out = File.join(root, 'artifacts/phase-1b/ios-tests')
FileUtils.mkdir_p(out)
project = Xcodeproj::Project.new(File.join(out, 'Acceptance.xcodeproj'))
target = project.new_target(:ui_test_bundle, 'Acceptance', :ios, '17.0')
source = project.main_group.new_file(File.join(__dir__, 'Acceptance.swift'))
target.source_build_phase.add_file_reference(source)
target.build_configurations.each do |config|
  config.build_settings['SWIFT_VERSION'] = '5.0'
  config.build_settings['GENERATE_INFOPLIST_FILE'] = 'YES'
  config.build_settings['PRODUCT_BUNDLE_IDENTIFIER'] = 'com.onechance.acceptance'
  config.build_settings['TARGETED_DEVICE_FAMILY'] = '1,2'
  config.build_settings['CODE_SIGNING_ALLOWED'] = 'NO'
end
scheme = Xcodeproj::XCScheme.new
scheme.add_build_target(target)
scheme.add_test_target(target)
project.save
scheme.save_as(project.path, 'Acceptance', true)
puts project.path
