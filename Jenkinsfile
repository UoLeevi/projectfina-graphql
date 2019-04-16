node {
    stage('Preparation') {
        git 'https://github.com/UoLeevi/projectfina-graphql.git'
    }
    stage('Build') {
        sh 'sudo npm install'
        sh 'sudo npm run build'
    }
    stage('Deploy') {
        sh 'sudo rm -rf /usr/local/projectfina-graphql/*'
        sh 'sudo cp -rf ./ /usr/local/projectfina-graphql/'
    }
    stage('Restart') {
        sh 'sudo systemctl restart projectfina-graphql.service'
    }
}
