'use strict';
// Определяем разработка это или финальная сборка
// Запуск `NODE_ENV=production npm start [задача]` приведет к сборке без sourcemaps
const isDev = !process.env.NODE_ENV || process.env.NODE_ENV == 'dev';
// Получаем настройки проекта из projectConfig.json
let projectConfig = require('./projectConfig.json');
let dirs = projectConfig.dirs;
//Подключаем все gulp плагины
const gulp = require('gulp');//Подключает сам gulp
const yarn = require('gulp-yarn');//Подключает yarn
const sass = require('gulp-sass');//Подключает препроцессор Sass
const path = require('path');//!!Разобраться в необходимости этого подключения!!
const plumber = require('gulp-plumber'); // формирует вывод об ошибке. Но при этом работа Gulp не прерывается.
const gutil = require('gulp-util'); //Отмечает ошибки красным
const debug = require('gulp-debug'); //Предотвращает неблагоприятные исходы
const notify = require('gulp-notify'); //Выводит оповещения
const sourcemaps = require('gulp-sourcemaps');//Создает карту
const wait = require('gulp-wait');//Делает паузу передж тем, как использовать следующую функцию
const postcss = require('gulp-postcss');//Добавляет postcss
const autoprefixer = require('autoprefixer');//Добавляет автоматическое добавление префиксов
const mqpacker = require("css-mqpacker");//Pack same CSS media query rules into one using PostCSS
const atImport = require("postcss-import");
const inlineSVG = require('postcss-inline-svg');
const objectFitImages = require('postcss-object-fit-images');
const del = require('del');//Удаление папок и файлов
const newer = require('gulp-newer');//Запускают таски только для изменившихся файлов
const jade = require('gulp-jade'); //Подключает шаблонизатор Jade
const uglify = require('gulp-uglify');//Минифицирует js код
const concat = require('gulp-concat');//Конкатинирует файлы
const gulpIf = require('gulp-if');//Добавляет условия
const imagemin = require('gulp-imagemin');//Сжимает изображения
const pngquant = require('imagemin-pngquant');//Сжимает png
const ghPages = require('gulp-gh-pages');//Отправляет на gh-pages
const gulpSequence = require('gulp-sequence');//Добавляет очередь
const browserSync = require('browser-sync').create();//Добавляет Browsersync

//Yarn это новый менеджер пакетов, совместно созданный Facebook, Google, Exponent и Tilde. Сайт: https://yarnpkg.com/
// При помощи команды gulp yarn подтягиваем dependencies 
gulp.task('yarn', function() {
    return gulp.src(['./package.json', './yarn.lock'])
        .pipe(gulp.dest('./'))
        .pipe(yarn({
            production: true
        }));
});

// Плагины postCSS, которыми обрабатываются все стилевые файлы
let postCssPlugins = [
  autoprefixer({browsers: ['last 2 version']}),
  mqpacker({
    sort: true
  }),
  atImport(),
  inlineSVG(),
  objectFitImages()
];

//Gulp-less компилирует Sass в css
gulp.task('style', function () {
  console.log('---------- Компиляция стилей');
  return gulp.src(dirs.srcPath + 'sass/style.sass')
    .pipe(plumber({
      errorHandler: function(err) {
        notify.onError({
          title: 'Styles compilation error',
          message: err.message
        })(err);
        this.emit('end');
      }
    }))
    .pipe(wait(100))
    .pipe(debug({title: "Style:"}))
    .pipe(sass())
    .pipe(postcss(postCssPlugins))
    .pipe(gulp.dest(dirs.buildPath + '/css'))
    //.pipe(browserSync.stream({match: '**/*.css'}));
});                           

// Очистка папки сборки
gulp.task('clean', function () {
  console.log('---------- Очистка папки сборки');
  return del([
    dirs.buildPath + '/**/*',
    '!' + dirs.buildPath + '/readme.md'
  ]);
});

// Копирование добавочных CSS, которые хочется иметь отдельными файлами
gulp.task('copy:css', function(callback) {
  if(projectConfig.copiedCss.length) {
    return gulp.src(projectConfig.copiedCss)
      .pipe(postcss(postCssPlugins))
      .pipe(gulp.dest(dirs.buildPath + '/css'))
      //.pipe(browserSync.stream());
  }
  else {
    callback();
  }
});
// Копирование изображений
gulp.task('copy:img', function () {
  console.log('---------- Копирование изображений');
  return gulp.src(dirs.srcPath + '/img/**/*.{jpg,jpeg,gif,png,svg,JPG}')
    .pipe(newer(dirs.buildPath + '/img'))  // оставить в потоке только изменившиеся файлы
    .pipe(gulp.dest(dirs.buildPath + '/img'));
});

// Копирование JS
gulp.task('copy:js', function (callback) {
  if(projectConfig.copiedJs.length) {
    return gulp.src(projectConfig.copiedJs)
      .pipe(gulp.dest(dirs.buildPath + '/js'));
  }
  else {
    callback();
  }
});

// Копирование шрифтов
gulp.task('copy:fonts', function () {
  console.log('---------- Копирование шрифтов');
  return gulp.src(dirs.srcPath + '/fonts/*.{ttf,woff,woff2,eot,svg}')
    .pipe(newer(dirs.buildPath + '/fonts'))  // оставить в потоке только изменившиеся файлы
    .pipe(gulp.dest(dirs.buildPath + '/fonts'));
});


//JADE 
 gulp.task('jade', function(){
     console.log('-----------Собирается JADE');
      return gulp.src(dirs.srcPath + '/*.jade')
    .pipe(plumber({
      errorHandler: function(err) {
        notify.onError({
          title: 'Jade compilation error',
          message: err.message
        })(err);
        this.emit('end');
      }
    }))
        .pipe(jade({
            pretty: true //Для того, что бы html был читаем, если убрать, то он будет минифицироваться
        }))
        .pipe(gulp.dest(dirs.buildPath))

 });

//Конкатенация и углификация Javascript
gulp.task('js', function (callback) {
    console.log('---------- Обработка JS');
    return gulp.src(dirs.srcPath + '/js/**/*.js')
      .pipe(debug({title: "JS:"}))
      .pipe(gulpIf(isDev, sourcemaps.init()))
      .pipe(concat('script.min.js'))
      .pipe(gulpIf(!isDev, uglify()))
      .on('error', notify.onError(function(err){
        return {
          title: 'Javascript uglify error',
          message: err.message
        }
      }))
      .pipe(gulpIf(isDev, sourcemaps.write('.')))
      .pipe(gulpIf(isDev, debug({title: "JS SOURCEMAPS:"})))
      .pipe(gulp.dest(dirs.buildPath + '/js'))
      .pipe(notify("JS COMPLETED"));
 
});

// Оптимизация изображений 
gulp.task('img:opt', function (callback) {
    console.log('---------- Оптимизация картинок');
    return gulp.src(dirs.srcPath + '/img/**/*.{jpg,jpeg,gif,png,svg,JPG}')
      .pipe(imagemin({
        progressive: true,
        optimizationLevel: 10,
        svgoPlugins: [{removeViewBox: false}],
        use: [pngquant()]
      }))
      .pipe(gulp.dest(dirs.buildPath + '/img'));
});
// Сборка всего
gulp.task('build', function (callback) {
  gulpSequence(
    'clean',
    ['style', 'js', 'copy:css', 'copy:img', 'copy:js', 'copy:fonts'],
    'jade',
    callback
  );
});

// Отправка в GH pages (ветку gh-pages репозитория)
gulp.task('deploy', function() {
  console.log('---------- Публикация содержимого ./build/ на GH pages');
  return gulp.src(dirs.buildPath + '**/*')
    .pipe(ghPages());
});
// Задача по умолчанию
gulp.task('default', ['serve']);

// Локальный сервер, слежение
gulp.task('serve', ['build'], function() {
  browserSync.init({
    server: dirs.buildPath,
    startPath: 'index.html',
    open: false,
    port: 8080,
  });

// Слежение за стилями
  gulp.watch([
    dirs.srcPath + 'sass/style.sass',
    dirs.srcPath + dirs.blocksDirName + '/**/*.sass',
    projectConfig.addCssBefore,
    projectConfig.addCssAfter,
  ], ['style']);

  // Слежение за добавочными стилями
  if(projectConfig.copiedCss.length) {
    gulp.watch(projectConfig.copiedCss, ['copy:css']);
  }
  // Слежение за изображениями
  if(dirs.srcPath + '/img/**/*.*'.length) {
    gulp.watch(dirs.srcPath + '/img/**/*.*', ['watch:img']);
  }
  'src/images/**/*.*', ['img`']
  // Слежение за добавочными JS
  if(projectConfig.copiedJs.length) {
    gulp.watch(projectConfig.copiedJs, ['watch:copied:js']);
  }
  // Слежение за шрифтами
  gulp.watch('/fonts/*.{ttf,woff,woff2,eot,svg}', {cwd: dirs.srcPath}, ['watch:fonts']);
  // Слежение за html
  gulp.watch([
    '*.jade',
    '_include/*.jade',
    dirs.blocksDirName + '/**/*.jade'
  ], {cwd: dirs.srcPath}, ['watch:jade']);
  // Слежение за JS
  if(dirs.srcPath + '/js/**/*.js'.length) {
    gulp.watch(dirs.srcPath + '/js/**/*.js', ['watch:js']);
  }
});

// Браузерсинк с 3-м галпом — такой браузерсинк...
gulp.task('watch:img', ['copy:img'], reload);
gulp.task('watch:copied:js', ['copy:js'], reload);
gulp.task('watch:fonts', ['copy:fonts'], reload);
gulp.task('watch:jade', ['jade'], reload);
gulp.task('watch:js', ['js'], reload);

                                    /* Слежение */

// gulp.task('start',['build' ,'browser-sync'], (cb) => {
//     gulp.watch('src/**/*.styl', ['stylus']);
//     gulp.watch('src/**/*.jade', ['jade']);
//     gulp.watch('src/**/*.js', ['js']);
//     gulp.watch('src/images/**/*.*', ['img`']);
    
// });

/**
 * Вернет объект с обрабатываемыми файлами и папками
 * @param  {object}
 * @return {object}
 */
function getFilesList(config){

  let res = {
    'css': [],
    'js': [],
    'img': [],
  };

  // Style
  for (let blockName in config.blocks) {
    res.css.push(config.dirs.srcPath + config.dirs.blocksDirName + '/' + blockName + '/' + blockName + '.scss');
    if(config.blocks[blockName].length) {
      config.blocks[blockName].forEach(function(elementName) {
        res.css.push(config.dirs.srcPath + config.dirs.blocksDirName + '/' + blockName + '/' + blockName + elementName + '.scss');
      });
    }
  }
  res.css = res.css.concat(config.addCssAfter);
  res.css = config.addCssBefore.concat(res.css);

  // JS
  for (let blockName in config.blocks) {
    res.js.push(config.dirs.srcPath + config.dirs.blocksDirName + '/' + blockName + '/' + blockName + '.js');
    if(config.blocks[blockName].length) {
      config.blocks[blockName].forEach(function(elementName) {
        res.js.push(config.dirs.srcPath + config.dirs.blocksDirName + '/' + blockName + '/' + blockName + elementName + '.js');
      });
    }
  }
  res.js = res.js.concat(config.addJsAfter);
  res.js = config.addJsBefore.concat(res.js);

  // Images
  for (let blockName in config.blocks) {
    res.img.push(config.dirs.srcPath + config.dirs.blocksDirName + '/' + blockName + '/img/*.{jpg,jpeg,gif,png,svg}');
  }
  res.img = config.addImages.concat(res.img);

  return res;
}

/**
 * Проверка существования файла или папки
 * @param  {string} path      Путь до файла или папки]
 * @return {boolean}
 */
function fileExist(path) {
  const fs = require('fs');
  try {
    fs.statSync(path);
  } catch(err) {
    return !(err && err.code === 'ENOENT');
  }
}

// Перезагрузка браузера
function reload (done) {
  browserSync.reload();
  done();
}