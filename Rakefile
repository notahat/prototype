require 'rake'
require 'rake/packagetask'

PROTOTYPE_ROOT     = File.expand_path(File.dirname(__FILE__))
PROTOTYPE_SRC_DIR  = File.join(PROTOTYPE_ROOT, 'src')
PROTOTYPE_DIST_DIR = File.join(PROTOTYPE_ROOT, 'dist')
PROTOTYPE_PKG_DIR  = File.join(PROTOTYPE_ROOT, 'pkg')
PROTOTYPE_TEST_DIR = File.join(PROTOTYPE_ROOT, 'test')
PROTOTYPE_TMP_DIR  = File.join(PROTOTYPE_TEST_DIR, 'unit', 'tmp')
PROTOTYPE_VERSION  = '1.6.0.2'

task :default => [:dist, :dist_helper, :package, :clean_package_source]

desc "Builds the distribution."
task :dist do
  $:.unshift File.join(PROTOTYPE_ROOT, 'lib')
  require 'protodoc'
  
  Dir.chdir(PROTOTYPE_SRC_DIR) do
    File.open(File.join(PROTOTYPE_DIST_DIR, 'prototype.js'), 'w+') do |dist|
      dist << Protodoc::Preprocessor.new('prototype.js')
    end
  end
end

desc "Builds the updating helper."
task :dist_helper do
  $:.unshift File.join(PROTOTYPE_ROOT, 'lib')
  require 'protodoc'
  
  Dir.chdir(File.join(PROTOTYPE_ROOT, 'ext', 'update_helper')) do
    File.open(File.join(PROTOTYPE_DIST_DIR, 'prototype_update_helper.js'), 'w+') do |dist|
      dist << Protodoc::Preprocessor.new('prototype_update_helper.js')
    end
  end
end

Rake::PackageTask.new('prototype', PROTOTYPE_VERSION) do |package|
  package.need_tar_gz = true
  package.package_dir = PROTOTYPE_PKG_DIR
  package.package_files.include(
    '[A-Z]*',
    'dist/prototype.js',
    'lib/**',
    'src/**',
    'test/**'
  )
end

desc "Builds the distribution and the test suite, runs the tests and collects their results."
task :test => [:dist, :test_units]

require 'test/lib/jstest'
desc "Runs all the JavaScript unit tests and collects the results"
JavaScriptTestTask.new(:test_units) do |t|
  testcases        = ENV['TESTCASES']
  tests_to_run     = ENV['TESTS']    && ENV['TESTS'].split(',')
  browsers_to_test = ENV['BROWSERS'] && ENV['BROWSERS'].split(',')
  
  t.mount("/dist")
  t.mount("/test")
  
  Dir.mkdir(PROTOTYPE_TMP_DIR) unless File.exist?(PROTOTYPE_TMP_DIR)
  
  Dir["test/unit/*_test.js"].each do |file|
    PageBuilder.new(file, 'prototype.erb').render
    test_file = File.basename(file, ".js")
    test_name = test_file.sub("_test", "")
    unless tests_to_run && !tests_to_run.include?(test_name)
      t.run("/test/unit/tmp/#{test_file}.html", testcases)
    end
  end
  
  %w( safari firefox ie konqueror opera ).each do |browser|
    t.browser(browser.to_sym) unless browsers_to_test && !browsers_to_test.include?(browser)
  end
end

desc 'Generates an empty tmp directory for building tests.'
task :rm_tmp do
  puts 'Generating an empty tmp directory for building tests.'
  FileUtils.rm_rf(PROTOTYPE_TMP_DIR) if File.exist?(PROTOTYPE_TMP_DIR)
  Dir.mkdir(PROTOTYPE_TMP_DIR)
end

namespace 'caja' do
  require 'test/lib/caja/caja.rb'
  
  desc 'Builds and cajoles gadgets.'
  task :cajole_gadgets => [:rm_tmp, :copy_assets, :copy_fixtures] do
    Dir["test/unit/*_test.js"].each do |file|
      puts "\nBuilding gadget for #{file}."
      puts "Cajoling gadget for #{file} (this might take a while)."
      FileUtils.cp(file, PROTOTYPE_TMP_DIR)
      begin
        Caja::GadgetBuilder.new(file).cajole
        puts "Building container for #{file}."
        Caja::ContainerBuilder.new(file).render
      rescue Caja::CompileError => e
        puts e
      end
    end
  end
  
  desc 'Copies assets to test/unit/tmp/assets directory.'
  task :copy_assets => [:dist] do
    puts 'Copying assets to test/unit/tmp/assets directory.'
    FileUtils.cp_r(File.join(PROTOTYPE_TEST_DIR, 'lib', 'assets'), PROTOTYPE_TMP_DIR)
    FileUtils.cp_r(File.join(PROTOTYPE_TEST_DIR, 'lib', 'caja', 'assets'), PROTOTYPE_TMP_DIR)
    FileUtils.cp(File.join(PROTOTYPE_DIST_DIR, 'prototype.js'), File.join(PROTOTYPE_TMP_DIR, 'assets'))
  end
  
  desc 'Copies fixtures to test/unit/tmp/fixtures directory.'
  task :copy_fixtures => [:dist] do
    puts 'Copying fixtures to test/unit/tmp/fixtures directory.'
    fixtures = File.join(PROTOTYPE_TMP_DIR, 'fixtures')
    FileUtils.rm_rf(fixtures)
    FileUtils.cp_r(File.join(PROTOTYPE_TEST_DIR, 'unit', 'fixtures'), fixtures)
  end
end
